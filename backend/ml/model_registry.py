"""
SolarAI Model Registry Module
Manages model serialization, version tracking, artifact persistence, and metadata storage.
"""

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import json
import joblib
from sqlalchemy.orm import Session
from app.models.model_metric import ModelMetric
from ml.preprocessing import FEATURE_NAMES, TARGET_NAME


@dataclass
class ModelMetadata:
    model_name: str
    model_version: str
    training_timestamp: str
    feature_names: List[str]
    target_name: str
    dataset_size: int
    train_size: int
    test_size: int
    mae: float
    rmse: float
    r2_score: float
    artifact_path: str
    is_best: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ModelMetadata":
        return cls(**data)


class ModelRegistry:
    """
    Registry for managing trained machine learning models, artifacts, and evaluation benchmarks.
    """

    def __init__(self, base_dir: Optional[Path] = None):
        if base_dir is None:
            base_dir = Path(__file__).resolve().parent
        self.base_dir = Path(base_dir)
        self.artifacts_dir = self.base_dir / "artifacts"
        self.models_dir = self.base_dir / "models"
        self.registry_file = self.artifacts_dir / "registry.json"

        # Ensure directories exist
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        self.models_dir.mkdir(parents=True, exist_ok=True)

    def _read_registry_file(self) -> Dict[str, Any]:
        if not self.registry_file.exists():
            return {"active_model_version": None, "models": []}
        try:
            with open(self.registry_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return {"active_model_version": None, "models": []}

    def _write_registry_file(self, data: Dict[str, Any]) -> None:
        with open(self.registry_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def save_model(
        self,
        model: Any,
        metadata: ModelMetadata,
        is_best: bool = True,
        db: Optional[Session] = None,
    ) -> str:
        """
        Serialize model artifact with joblib, register metadata, and optionally persist to DB.
        """
        artifact_filename = f"{metadata.model_version}.joblib"
        artifact_path = self.models_dir / artifact_filename
        joblib.dump(model, artifact_path)

        metadata.artifact_path = str(artifact_path)
        metadata.is_best = is_best

        # Update JSON registry file
        reg_data = self._read_registry_file()
        models_list = reg_data.get("models", [])

        # Demote previous best if new best is designated
        if is_best:
            reg_data["active_model_version"] = metadata.model_version
            for m in models_list:
                m["is_best"] = False

        models_list.append(metadata.to_dict())
        reg_data["models"] = models_list
        self._write_registry_file(reg_data)

        # Also save a canonical 'best_model.joblib' pointer for fast loading
        if is_best:
            best_pointer_path = self.models_dir / "best_model.joblib"
            best_meta_path = self.artifacts_dir / "best_model_meta.json"
            joblib.dump(model, best_pointer_path)
            with open(best_meta_path, "w", encoding="utf-8") as f:
                json.dump(metadata.to_dict(), f, indent=2)

        # Persist to database table 'model_metrics' if db session passed
        if db is not None:
            self.record_metric_in_db(db, metadata)

        return str(artifact_path)

    def record_metric_in_db(self, db: Session, metadata: ModelMetadata) -> None:
        """
        Record training benchmark in PostgreSQL/SQLite 'model_metrics' table.
        """
        try:
            metric_entry = ModelMetric(
                model_name=metadata.model_name,
                model_version=metadata.model_version,
                evaluation_date=datetime.now(timezone.utc),
                mae=metadata.mae,
                rmse=metadata.rmse,
                r2_score=metadata.r2_score,
                dataset_size=metadata.test_size,
                notes=f"Trained on {metadata.train_size} samples. Features: {', '.join(metadata.feature_names)}",
            )
            db.add(metric_entry)
            db.commit()
        except Exception as e:
            db.rollback()
            # Do not crash training if DB metric logging has non-critical issue
            print(f"[ModelRegistry] Failed to log metric in DB: {e}")

    def load_best_model(self) -> Tuple[Any, ModelMetadata]:
        """
        Load the currently active/best model artifact and its metadata.
        Raises FileNotFoundError if no model has been trained yet.
        """
        best_pointer_path = self.models_dir / "best_model.joblib"
        best_meta_path = self.artifacts_dir / "best_model_meta.json"

        if not best_pointer_path.exists() or not best_meta_path.exists():
            raise FileNotFoundError("No trained model artifact is currently available.")

        with open(best_meta_path, "r", encoding="utf-8") as f:
            meta_dict = json.load(f)

        metadata = ModelMetadata.from_dict(meta_dict)
        model = joblib.load(best_pointer_path)
        return model, metadata

    def list_models(self) -> List[Dict[str, Any]]:
        """List all trained model versions and their benchmark metrics."""
        reg_data = self._read_registry_file()
        return reg_data.get("models", [])

    def get_status(self) -> Dict[str, Any]:
        """Check whether a trained model is currently available for inference."""
        best_pointer_path = self.models_dir / "best_model.joblib"
        best_meta_path = self.artifacts_dir / "best_model_meta.json"

        if best_pointer_path.exists() and best_meta_path.exists():
            try:
                with open(best_meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                return {
                    "model_available": True,
                    "active_model": meta,
                    "message": f"Active model '{meta.get('model_name')}' ({meta.get('model_version')}) ready for inference.",
                }
            except Exception:
                pass

        return {
            "model_available": False,
            "active_model": None,
            "message": "No trained model currently available. Train a model using POST /api/v1/ml/train.",
        }


# Global registry instance
default_registry = ModelRegistry()
