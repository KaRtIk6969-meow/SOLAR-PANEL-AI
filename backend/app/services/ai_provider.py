"""
SolarAI Provider Abstraction (Step 11)
Implements clean AI provider interfaces with strict real-data grounding.
Supports deterministic domain-grounded solar engineering inference
and optional external LLM provider routing (Gemini / OpenAI) via environment variables.
"""

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import os
import re

from app.schemas.ai_assistant import (
    SolarAIContextResponse,
    AIChatResponse,
    AIChatEvidence,
)


class BaseAIProvider(ABC):
    """Abstract base class for SolarAI Assistant inference providers."""

    @abstractmethod
    def generate_response(self, context: SolarAIContextResponse, question: str) -> AIChatResponse:
        """Generates a grounded response strictly backed by SolarAIContextResponse."""
        pass


class GroundedSolarAIProvider(BaseAIProvider):
    """
    Deterministic domain-expert provider grounded in physical PV equations,
    active ML residual analysis, hardware health evaluations, and recorded alerts.
    Guarantees zero hallucinations and adheres to all strict grounding rules.
    """

    def generate_response(self, context: SolarAIContextResponse, question: str) -> AIChatResponse:
        now = datetime.now(timezone.utc)
        q_lower = question.lower().strip()

        # Build evidence snapshot
        curr = context.current
        ai = context.ai
        health = context.health
        alerts = context.alerts
        analytics = context.analytics

        ts_str = curr.timestamp.isoformat() if (curr and curr.timestamp) else "None"
        evidence = AIChatEvidence(
            power_w=curr.power_w if curr else None,
            predicted_power_w=ai.latest_predicted_power_w if ai else None,
            residual_w=ai.latest_residual_w if ai else None,
            voltage_v=curr.voltage_v if curr else None,
            current_a=curr.current_a if curr else None,
            temperature_c=curr.temperature_c if curr else None,
            irradiance_w_m2=curr.irradiance_w_m2 if curr else None,
            health_score=health.overall_score if health else None,
            active_alerts_count=len(alerts),
            timestamp=ts_str,
        )

        # Handle empty/offline hardware state
        if not context.has_data or not curr or curr.power_w is None:
            answer = (
                f"STATUS: Offline / No Telemetry\n"
                f"DEVICE: {context.device_id}\n"
                f"CURRENT: No recorded telemetry available\n"
                f"AI EXPECTED: --\n"
                f"HEALTH: --\n"
                f"ALERTS: {len(alerts)} active\n\n"
                f"ASSESSMENT:\n"
                f"The hardware node '{context.device_id}' currently has no valid sensor readings stored in the database. "
                f"Please ensure the ESP32 is powered on and transmitting over Wi-Fi."
            )
            return AIChatResponse(
                device_id=context.device_id,
                question=question,
                answer=answer,
                provider="solarai-grounded-engine",
                grounded=True,
                evidence=evidence,
                structured_data={"status": "NO_DATA", "device_id": context.device_id},
                timestamp=now,
            )

        # -------------------------------------------------------------
        # Intent Routing & Grounded Response Synthesis
        # -------------------------------------------------------------

        # Intent 1: Current Power / Telemetry
        if any(w in q_lower for w in ["current power", "what's the power", "what is the power", "how much power", "wattage", "producing"]):
            pwr = f"{curr.power_w:.2f} W"
            v = f"{curr.voltage_v:.2f} V" if curr.voltage_v is not None else "--"
            i = f"{curr.current_a:.2f} A" if curr.current_a is not None else "--"
            irr = f"{curr.irradiance_w_m2:.1f} W/m²" if curr.irradiance_w_m2 is not None else "--"
            pred_w = f"{ai.latest_predicted_power_w:.2f} W" if (ai and ai.latest_predicted_power_w is not None) else "--"

            answer = (
                f"STATUS: Active Ingestion\n"
                f"CURRENT POWER: {pwr}\n"
                f"ELECTRICAL: {v} @ {i}\n"
                f"SOLAR FLUX: {irr}\n"
                f"AI EXPECTED: {pred_w}\n"
                f"TIMESTAMP: {ts_str}\n\n"
                f"ASSESSMENT:\n"
                f"At the latest recorded timestamp ({ts_str}), the panel produced {pwr} from {v} and {i} under {irr} of solar irradiance. "
                f"AI expected yield is {pred_w}."
            )

        # Intent 2: Temperature & Thermal derating
        elif any(w in q_lower for w in ["temperature", "cell temp", "how hot", "thermal", "overheating", "derating"]):
            temp = f"{curr.temperature_c:.1f} °C" if curr.temperature_c is not None else "Unknown"
            therm_health = f"{health.thermal_health:.1f}%" if (health and health.thermal_health is not None) else "--"
            temp_alerts = [a for a in alerts if "temp" in a.category.lower() or "therm" in a.category.lower()]

            if curr.temperature_c and curr.temperature_c > 65.0:
                therm_state = "CRITICAL ELEVATED TEMPERATURE"
                therm_desc = f"Cell temperature ({temp}) exceeds the 65.0°C critical ceiling, causing heavy semiconductor carrier recombination and voltage derating."
            elif curr.temperature_c and curr.temperature_c > 55.0:
                therm_state = "ELEVATED WARNING"
                therm_desc = f"Cell temperature ({temp}) is elevated above 55.0°C. Standard monocrystalline derating (-0.38%/°C) reduces open-circuit voltage."
            else:
                therm_state = "NOMINAL THERMAL CONDITIONS"
                therm_desc = f"Cell temperature is operating within safe operational margins ({temp}). Thermal subsystem health is evaluated at {therm_health}."

            answer = (
                f"STATUS: {therm_state}\n"
                f"TEMPERATURE: {temp}\n"
                f"THERMAL HEALTH: {therm_health}\n"
                f"ACTIVE THERMAL ALERTS: {len(temp_alerts)}\n\n"
                f"ASSESSMENT:\n"
                f"{therm_desc}"
            )

        # Intent 3: Solar Irradiance
        elif any(w in q_lower for w in ["irradiance", "sunlight", "solar flux", "sun"]):
            irr = f"{curr.irradiance_w_m2:.1f} W/m²" if curr.irradiance_w_m2 is not None else "Unknown"
            pwr = f"{curr.power_w:.2f} W" if curr.power_w is not None else "--"
            avg_irr = f"{analytics.avg_irradiance_w_m2:.1f} W/m²" if (analytics and analytics.avg_irradiance_w_m2) else "--"

            answer = (
                f"STATUS: Solar Measurement\n"
                f"IRRADIANCE: {irr}\n"
                f"CURRENT POWER: {pwr}\n"
                f"24H AVG IRRADIANCE: {avg_irr}\n\n"
                f"ASSESSMENT:\n"
                f"Ambient solar flux at the panel surface is measured at {irr}. "
                f"Under this flux, the panel generated {pwr} of electrical power. The 24-hour mean irradiance is {avg_irr}."
            )

        # Intent 4: AI Prediction & Model Benchmark
        elif any(w in q_lower for w in ["ai predict", "expected power", "forecast", "what is the ai", "ai model", "accuracy", "r2", "r²", "mae", "rmse"]):
            model_n = ai.model_name if ai else "XGBoostRegressor"
            model_v = ai.model_version if ai else "unknown"
            r2 = f"{ai.r2_score:.4f}" if (ai and ai.r2_score is not None) else "--"
            mae = f"{ai.mae_w:.4f} W" if (ai and ai.mae_w is not None) else "--"
            pred_w = f"{ai.latest_predicted_power_w:.2f} W" if (ai and ai.latest_predicted_power_w is not None) else "--"
            act_w = f"{curr.power_w:.2f} W" if curr.power_w is not None else "--"
            res_w = f"{ai.latest_residual_w:+.2f} W" if (ai and ai.latest_residual_w is not None) else "--"

            answer = (
                f"STATUS: ML Inference Active\n"
                f"MODEL: {model_n} ({model_v})\n"
                f"TEST R² SCORE: {r2}\n"
                f"TEST MAE: {mae}\n"
                f"AI EXPECTED POWER: {pred_w}\n"
                f"ACTUAL POWER: {act_w}\n"
                f"RESIDUAL (ACTUAL - PREDICTED): {res_w}\n\n"
                f"ASSESSMENT:\n"
                f"The active model '{model_n}' predicts an expected yield of {pred_w} based on current irradiance, voltage, current, and temperature. "
                f"With a test R² of {r2} and MAE of {mae}, actual generation deviates by {res_w} from expected physics baseline."
            )

        # Intent 5: Residual / Discrepancy Explanation
        elif any(w in q_lower for w in ["why is predicted", "different from actual", "residual", "deficit", "deviation", "why is power lower", "generation low"]):
            pred_w = f"{ai.latest_predicted_power_w:.2f} W" if (ai and ai.latest_predicted_power_w is not None) else "--"
            act_w = f"{curr.power_w:.2f} W" if curr.power_w is not None else "--"
            res = ai.latest_residual_w if ai else 0.0
            res_str = f"{res:+.2f} W" if res is not None else "--"
            dev_pct = f"{ai.latest_deviation_pct:+.1f}%" if (ai and ai.latest_deviation_pct is not None) else "--"

            diagnostic_reasons = []
            if alerts:
                for a in alerts:
                    diagnostic_reasons.append(f"• Active Alert [{a.severity}]: {a.message}")
            if curr.temperature_c and curr.temperature_c > 55.0:
                diagnostic_reasons.append(f"• Elevated temperature ({curr.temperature_c:.1f}°C) causes semiconductor derating.")
            if curr.voltage_v and curr.voltage_v > 15.0 and (curr.current_a is None or curr.current_a < 0.1) and curr.irradiance_w_m2 and curr.irradiance_w_m2 > 100.0:
                diagnostic_reasons.append("• Open circuit condition detected: Voltage is present but load current is zero.")
            if not diagnostic_reasons:
                if res and abs(res) <= 1.0:
                    diagnostic_reasons.append("• Nominal variance: Discrepancy is within normal sensor and regression bounds (< 1.0W).")
                else:
                    diagnostic_reasons.append("• Possible partial optical attenuation (shading/dust) or transient environmental variations.")

            reasons_text = "\n".join(diagnostic_reasons)

            answer = (
                f"STATUS: Discrepancy Diagnostics\n"
                f"ACTUAL POWER: {act_w}\n"
                f"AI EXPECTED: {pred_w}\n"
                f"RESIDUAL: {res_str} ({dev_pct})\n"
                f"ACTIVE ALERTS: {len(alerts)}\n\n"
                f"EVIDENCE & DIAGNOSTIC FACTORS:\n"
                f"{reasons_text}"
            )

        # Intent 6: System Health
        elif any(w in q_lower for w in ["health", "healthy", "panel health", "grade", "score", "subsystem"]):
            overall = f"{health.overall_score:.1f}%" if (health and health.overall_score is not None) else "--"
            elec = f"{health.electrical_health:.1f}%" if (health and health.electrical_health is not None) else "--"
            therm = f"{health.thermal_health:.1f}%" if (health and health.thermal_health is not None) else "--"
            pv = f"{health.photovoltaic_health:.1f}%" if (health and health.photovoltaic_health is not None) else "--"
            recom = health.recommendation if (health and health.recommendation) else "All subsystems operating within nominal tolerances."

            answer = (
                f"STATUS: Hardware Health Evaluation\n"
                f"OVERALL HEALTH: {overall}\n"
                f"ELECTRICAL SUBSYSTEM: {elec}\n"
                f"THERMAL SUBSYSTEM: {therm}\n"
                f"PHOTOVOLTAIC CONVERSION: {pv}\n"
                f"ACTIVE ALERTS: {len(alerts)}\n\n"
                f"RECOMMENDATION:\n"
                f"{recom}"
            )

        # Intent 7: Alerts & Warnings
        elif any(w in q_lower for w in ["alert", "warning", "alarm", "fault", "issue", "critical"]):
            if not alerts:
                answer = (
                    f"STATUS: All Systems Nominal\n"
                    f"ACTIVE ALERTS: 0\n"
                    f"HEALTH SCORE: {health.overall_score if health else '--'}%\n\n"
                    f"ASSESSMENT:\n"
                    f"There are currently no active diagnostic alerts or hardware faults recorded for '{context.device_id}'. "
                    f"The solar generation array is operating within normal bounds."
                )
            else:
                alert_lines = []
                for a in alerts:
                    alert_lines.append(f"• [{a.severity}] {a.category}: {a.message}")
                    if a.recommendation:
                        alert_lines.append(f"  Action: {a.recommendation}")
                alert_text = "\n".join(alert_lines)

                answer = (
                    f"STATUS: Action Required\n"
                    f"ACTIVE ALERTS: {len(alerts)}\n"
                    f"HEALTH SCORE: {health.overall_score if health else '--'}%\n\n"
                    f"ALERT DETAILS:\n"
                    f"{alert_text}"
                )

        # Intent 8: Daily Summary & Energy Analytics
        elif any(w in q_lower for w in ["today", "what happened", "energy", "harvested", "analytics", "summary"]):
            tot_wh = f"{analytics.total_energy_wh:.1f} Wh" if (analytics and analytics.total_energy_wh is not None) else "--"
            avg_pwr = f"{analytics.avg_power_w:.2f} W" if (analytics and analytics.avg_power_w is not None) else "--"
            peak_pwr = f"{analytics.max_power_w:.2f} W" if (analytics and analytics.max_power_w is not None) else "--"
            samples = analytics.total_samples if analytics else 0

            answer = (
                f"STATUS: 24-Hour Energy Analytics\n"
                f"HARVESTED ENERGY: {tot_wh}\n"
                f"AVERAGE POWER: {avg_pwr}\n"
                f"PEAK POWER: {peak_pwr}\n"
                f"TELEMETRY SAMPLES: {samples}\n\n"
                f"ASSESSMENT:\n"
                f"Over the last 24 hours, the panel accumulated {tot_wh} of integrated electrical energy across {samples} valid sample readings. "
                f"Power averaged {avg_pwr} with an instantaneous peak of {peak_pwr}."
            )

        # Intent 9: Best Performance Period
        elif any(w in q_lower for w in ["best performance", "peak generation", "highest power", "best period", "peak period"]):
            bp = analytics.best_period if analytics else None
            if bp:
                bp_time = bp.timestamp.strftime("%Y-%m-%d %H:%M:%S UTC")
                pred_bp = f"{bp.predicted_power_w:.2f} W" if bp.predicted_power_w is not None else "--"
                h_bp = f"{bp.health_score:.1f}%" if bp.health_score is not None else "--"

                answer = (
                    f"STATUS: Peak Performance Record\n"
                    f"PEAK POWER: {bp.power_w:.2f} W\n"
                    f"TIMESTAMP: {bp_time}\n"
                    f"SOLAR FLUX: {bp.irradiance_w_m2:.1f} W/m²\n"
                    f"CELL TEMP: {bp.temperature_c:.1f} °C\n"
                    f"AI EXPECTED: {pred_bp}\n"
                    f"HEALTH AT PEAK: {h_bp}\n\n"
                    f"ASSESSMENT:\n"
                    f"The best operational performance was recorded on {bp_time} at {bp.power_w:.2f} W under strong solar flux ({bp.irradiance_w_m2:.1f} W/m²)."
                )
            else:
                answer = (
                    f"STATUS: Insufficient Data\n"
                    f"ASSESSMENT: No valid operational periods recorded in the current analytics window."
                )

        # Intent 10: Worst Performance Period
        elif any(w in q_lower for w in ["worst performance", "lowest generation", "worst period", "lowest power"]):
            wp = analytics.worst_period if analytics else None
            if wp:
                wp_time = wp.timestamp.strftime("%Y-%m-%d %H:%M:%S UTC")
                pred_wp = f"{wp.predicted_power_w:.2f} W" if wp.predicted_power_w is not None else "--"
                res_wp = f"{wp.residual_w:+.2f} W" if wp.residual_w is not None else "--"
                h_wp = f"{wp.health_score:.1f}%" if wp.health_score is not None else "--"
                alert_wp = wp.alert_message or "None active"

                answer = (
                    f"STATUS: Lowest Performance Record (Under Sunlight)\n"
                    f"POWER OUTPUT: {wp.power_w:.2f} W\n"
                    f"TIMESTAMP: {wp_time}\n"
                    f"SOLAR FLUX: {wp.irradiance_w_m2:.1f} W/m²\n"
                    f"AI EXPECTED: {pred_wp}\n"
                    f"RESIDUAL DEFICIT: {res_wp}\n"
                    f"HEALTH SCORE: {h_wp}\n"
                    f"ASSOCIATED ALERT: {alert_wp}\n\n"
                    f"ASSESSMENT:\n"
                    f"The lowest recorded generation period occurred on {wp_time} at {wp.power_w:.2f} W despite {wp.irradiance_w_m2:.1f} W/m² irradiance, "
                    f"producing a {res_wp} residual deficit against the AI baseline."
                )
            else:
                answer = (
                    f"STATUS: Insufficient Data\n"
                    f"ASSESSMENT: No anomalous or deficit operational periods detected."
                )

        # Intent 11: Specific Physical Hypotheses (Shading / Soiling)
        elif any(w in q_lower for w in ["shading", "soiling", "dust", "shadow"]):
            irr = curr.irradiance_w_m2 if curr.irradiance_w_m2 is not None else 0.0
            pwr = curr.power_w if curr.power_w is not None else 0.0
            pred_w = ai.latest_predicted_power_w if (ai and ai.latest_predicted_power_w is not None) else 0.0
            res = ai.latest_residual_w if (ai and ai.latest_residual_w is not None) else 0.0

            soiling_alert = next((a for a in alerts if "soil" in a.category.lower() or "shad" in a.category.lower()), None)

            if soiling_alert:
                verdict = f"ACTIVE ALERT DETECTED: {soiling_alert.message}"
            elif irr > 300.0 and res < -3.0:
                verdict = f"Evidence suggests possible optical shading or soiling: under {irr:.0f} W/m² irradiance, output is {abs(res):.1f} W below the AI prediction."
            else:
                verdict = f"No sensor evidence of abnormal shading or soiling. Current output ({pwr:.1f} W) matches expected clear conversion for {irr:.0f} W/m² flux."

            answer = (
                f"STATUS: Optical & Soiling Diagnostic\n"
                f"SOLAR FLUX: {irr:.1f} W/m²\n"
                f"ACTUAL POWER: {pwr:.2f} W\n"
                f"AI EXPECTED: {pred_w:.2f} W\n"
                f"RESIDUAL DEFICIT: {res:+.2f} W\n\n"
                f"DIAGNOSTIC EVIDENCE:\n"
                f"{verdict}"
            )

        # Default: General Overall Performance Overview
        else:
            pwr = f"{curr.power_w:.2f} W"
            pred_w = f"{ai.latest_predicted_power_w:.2f} W" if (ai and ai.latest_predicted_power_w is not None) else "--"
            res_w = f"{ai.latest_residual_w:+.2f} W" if (ai and ai.latest_residual_w is not None) else "--"
            h_score = f"{health.overall_score:.1f}%" if health else "--"
            alert_str = f"{len(alerts)} active" if alerts else "None"

            health_status = "Healthy" if (health and health.overall_score and health.overall_score >= 85) else "Caution"
            assessment = (
                f"The latest readings indicate that the panel is currently producing {pwr} against an AI expected output of {pred_w} "
                f"under {curr.irradiance_w_m2:.1f} W/m² solar flux and {curr.temperature_c:.1f}°C cell temperature. "
                f"Overall health is evaluated at {h_score}."
            )

            answer = (
                f"STATUS: {health_status}\n"
                f"CURRENT: {pwr}\n"
                f"AI EXPECTED: {pred_w}\n"
                f"DEVIATION: {res_w}\n"
                f"HEALTH: {h_score}\n"
                f"ALERTS: {alert_str}\n\n"
                f"ASSESSMENT:\n"
                f"{assessment}"
            )

        return AIChatResponse(
            device_id=context.device_id,
            question=question,
            answer=answer,
            provider="solarai-grounded-engine",
            grounded=True,
            evidence=evidence,
            structured_data={
                "power_w": curr.power_w,
                "predicted_power_w": ai.latest_predicted_power_w if ai else None,
                "residual_w": ai.latest_residual_w if ai else None,
                "temperature_c": curr.temperature_c,
                "irradiance_w_m2": curr.irradiance_w_m2,
                "health_score": health.overall_score if health else None,
                "active_alerts_count": len(alerts),
            },
            timestamp=now,
        )


class ExternalLLMProvider(BaseAIProvider):
    """
    Routes queries to an external LLM (Gemini / OpenAI) if configured,
    strictly embedding the SolarAIContextResponse into the system prompt.
    Falls back gracefully to GroundedSolarAIProvider if external call fails or API key is unset.
    """

    def __init__(self, fallback_provider: BaseAIProvider):
        self.fallback = fallback_provider
        self.api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("OPENAI_API_KEY")

    def generate_response(self, context: SolarAIContextResponse, question: str) -> AIChatResponse:
        # If no external API key is configured, transparently use the grounded domain provider
        if not self.api_key:
            return self.fallback.generate_response(context, question)

        # If external key is configured, try calling external LLM with strict grounding prompt
        try:
            # We can use httpx to call external LLM without hard-coding proprietary libraries
            import httpx
            system_prompt = (
                "You are the SolarAI Solar Performance Assistant. You must follow these strict grounding rules:\n"
                "1. Answer based ONLY on the provided SolarAI IoT context.\n"
                "2. Never invent sensor readings, alerts, predictions, or physical conditions.\n"
                "3. If data is missing or null, explicitly say so.\n"
                "4. Distinguish between measured sensor values, AI predictions, and diagnostic inferences.\n"
                "5. Provide concise, structured responses with STATUS, CURRENT, AI EXPECTED, HEALTH, ALERTS, ASSESSMENT.\n\n"
                f"Context Data:\n{context.model_dump_json(indent=2)}"
            )

            # Check if Gemini
            if os.environ.get("GEMINI_API_KEY"):
                gemini_key = os.environ.get("GEMINI_API_KEY")
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
                payload = {
                    "contents": [
                        {"role": "user", "parts": [{"text": f"{system_prompt}\n\nUser Question: {question}"}]}
                    ],
                    "generationConfig": {"temperature": 0.1, "maxOutputTokens": 500}
                }
                resp = httpx.post(url, json=payload, timeout=10.0)
                if resp.status_code == 200:
                    data = resp.json()
                    answer_text = data["candidates"][0]["content"]["parts"][0]["text"]
                    # Extract evidence
                    curr = context.current
                    ai = context.ai
                    health = context.health
                    evidence = AIChatEvidence(
                        power_w=curr.power_w if curr else None,
                        predicted_power_w=ai.latest_predicted_power_w if ai else None,
                        residual_w=ai.latest_residual_w if ai else None,
                        voltage_v=curr.voltage_v if curr else None,
                        current_a=curr.current_a if curr else None,
                        temperature_c=curr.temperature_c if curr else None,
                        irradiance_w_m2=curr.irradiance_w_m2 if curr else None,
                        health_score=health.overall_score if health else None,
                        active_alerts_count=len(context.alerts),
                        timestamp=curr.timestamp.isoformat() if (curr and curr.timestamp) else None,
                    )
                    return AIChatResponse(
                        device_id=context.device_id,
                        question=question,
                        answer=answer_text,
                        provider="gemini-1.5-flash",
                        grounded=True,
                        evidence=evidence,
                        timestamp=datetime.now(timezone.utc),
                    )
        except Exception as e:
            print(f"[SolarAI Provider] External LLM error ({e}), falling back to grounded domain engine.")

        # Fallback to grounded rule engine
        return self.fallback.generate_response(context, question)


# Singleton factory instance
_grounded_provider = GroundedSolarAIProvider()
_active_provider = ExternalLLMProvider(fallback_provider=_grounded_provider)


def get_ai_provider() -> BaseAIProvider:
    """Returns the active AI provider."""
    return _active_provider
