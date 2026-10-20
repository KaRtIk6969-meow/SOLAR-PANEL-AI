"""Initial Phase 3 PostgreSQL & SQLite Database Schema

Revision ID: 001_initial_phase3_schema
Revises: 
Create Date: 2026-10-20 12:00:00.000000

Creates production schema for SolarAI:
- devices
- sensor_readings
- predictions
- alerts
- health_scores
- model_metrics
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '001_initial_phase3_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Devices Table
    op.create_table(
        'devices',
        sa.Column('id', sa.String(length=64), primary_key=True, nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('location', sa.String(length=256), nullable=True),
        sa.Column('rated_power_w', sa.Float(), server_default='100.0', nullable=False),
        sa.Column('panel_area_m2', sa.Float(), server_default='0.65', nullable=False),
        sa.Column('temp_coeff', sa.Float(), server_default='-0.0038', nullable=False),
        sa.Column('firmware_version', sa.String(length=32), server_default='1.0.0', nullable=False),
        sa.Column('status', sa.String(length=32), server_default='ONLINE', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('1'), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_devices_id', 'devices', ['id'], unique=True)

    # 2. Sensor Readings Table (Real Hardware Telemetry)
    op.create_table(
        'sensor_readings',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True, nullable=False),
        sa.Column('device_id', sa.String(length=64), sa.ForeignKey('devices.id', ondelete='CASCADE'), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('voltage_v', sa.Float(), nullable=False),
        sa.Column('current_a', sa.Float(), nullable=False),
        sa.Column('temperature_c', sa.Float(), nullable=False),
        sa.Column('irradiance_w_m2', sa.Float(), nullable=False),
        sa.Column('power_w', sa.Float(), nullable=False),
        sa.Column('efficiency_pct', sa.Float(), nullable=True),
        sa.Column('data_quality', sa.String(length=32), server_default='GOOD', nullable=False),
        sa.Column('firmware_version', sa.String(length=32), server_default='1.0.0', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('device_id', 'timestamp', name='uq_sensor_reading_device_timestamp'),
    )
    op.create_index('ix_sensor_readings_device_id', 'sensor_readings', ['device_id'], unique=False)
    op.create_index('ix_sensor_readings_timestamp', 'sensor_readings', ['timestamp'], unique=False)
    op.create_index('idx_sensor_reading_device_timestamp', 'sensor_readings', ['device_id', 'timestamp'], unique=False)

    # 3. Predictions Table (AI Inference & Residuals)
    op.create_table(
        'predictions',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True, nullable=False),
        sa.Column('device_id', sa.String(length=64), sa.ForeignKey('devices.id', ondelete='CASCADE'), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('target', sa.String(length=64), server_default='power_w', nullable=False),
        sa.Column('predicted_value', sa.Float(), nullable=False),
        sa.Column('actual_value', sa.Float(), nullable=True),
        sa.Column('residual', sa.Float(), nullable=True),
        sa.Column('deviation_pct', sa.Float(), nullable=True),
        sa.Column('alert_status', sa.String(length=32), server_default='NORMAL', nullable=False),
        sa.Column('model_version', sa.String(length=64), server_default='rf_v1.0.0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_predictions_device_id', 'predictions', ['device_id'], unique=False)
    op.create_index('ix_predictions_timestamp', 'predictions', ['timestamp'], unique=False)
    op.create_index('idx_predictions_device_timestamp', 'predictions', ['device_id', 'timestamp'], unique=False)

    # 4. Alerts Table (System, Electrical & Diagnostic Alarms)
    op.create_table(
        'alerts',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True, nullable=False),
        sa.Column('device_id', sa.String(length=64), sa.ForeignKey('devices.id', ondelete='CASCADE'), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('severity', sa.String(length=32), server_default='WARNING', nullable=False),
        sa.Column('category', sa.String(length=64), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('is_resolved', sa.Boolean(), server_default=sa.text('0'), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_alerts_device_id', 'alerts', ['device_id'], unique=False)
    op.create_index('ix_alerts_timestamp', 'alerts', ['timestamp'], unique=False)
    op.create_index('idx_alerts_device_timestamp', 'alerts', ['device_id', 'timestamp'], unique=False)
    op.create_index('idx_alerts_status', 'alerts', ['is_resolved', 'severity'], unique=False)

    # 5. Health Scores Table (Composite & Dimensional Health)
    op.create_table(
        'health_scores',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True, nullable=False),
        sa.Column('device_id', sa.String(length=64), sa.ForeignKey('devices.id', ondelete='CASCADE'), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('overall_score', sa.Float(), nullable=False),
        sa.Column('electrical_health', sa.Float(), nullable=False),
        sa.Column('thermal_health', sa.Float(), nullable=False),
        sa.Column('photovoltaic_health', sa.Float(), nullable=False),
        sa.Column('degradation_factor', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('recommendation', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_health_scores_device_id', 'health_scores', ['device_id'], unique=False)
    op.create_index('ix_health_scores_timestamp', 'health_scores', ['timestamp'], unique=False)
    op.create_index('idx_health_scores_device_timestamp', 'health_scores', ['device_id', 'timestamp'], unique=False)

    # 6. Model Metrics Table (Model Evaluation & Performance Tracking)
    op.create_table(
        'model_metrics',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True, nullable=False),
        sa.Column('model_name', sa.String(length=128), nullable=False),
        sa.Column('model_version', sa.String(length=64), nullable=False),
        sa.Column('evaluation_date', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('mae', sa.Float(), nullable=False),
        sa.Column('rmse', sa.Float(), nullable=False),
        sa.Column('r2_score', sa.Float(), nullable=False),
        sa.Column('dataset_size', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_model_metrics_evaluation_date', 'model_metrics', ['evaluation_date'], unique=False)
    op.create_index('idx_model_metrics_name_version', 'model_metrics', ['model_name', 'model_version'], unique=False)


def downgrade() -> None:
    op.drop_table('model_metrics')
    op.drop_table('health_scores')
    op.drop_table('alerts')
    op.drop_table('predictions')
    op.drop_table('sensor_readings')
    op.drop_table('devices')
