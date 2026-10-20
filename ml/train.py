import sys
from pathlib import Path
backend_path = Path(__file__).resolve().parent.parent / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from ml.train import *

if __name__ == "__main__":
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        print("[SolarAI ML] Starting model training on database telemetry...")
        report = train_and_evaluate_models(db)
        print(f"[SolarAI ML] Training complete. Best model: {report.best_model_name} ({report.best_model_version})")
        print(f"[SolarAI ML] Metrics: MAE={report.best_metrics['mae']} W, RMSE={report.best_metrics['rmse']} W, R2={report.best_metrics['r2_score']}")
    except InsufficientDataError as e:
        print(f"[SolarAI ML] Warning: {e}")
    finally:
        db.close()
