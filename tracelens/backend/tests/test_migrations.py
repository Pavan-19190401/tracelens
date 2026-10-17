"""Test Alembic database migrations: upgrade to head, verify tables, and downgrade to base."""

import os

from alembic.config import Config
from sqlalchemy import create_engine, inspect

from alembic import command


def test_alembic_migration_up_down(tmp_path):
    test_db_path = tmp_path / "test_migration.db"
    test_db_url = f"sqlite:///{test_db_path.as_posix()}"

    # Path to alembic.ini
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    alembic_ini_path = os.path.join(backend_dir, "alembic.ini")

    alembic_cfg = Config(alembic_ini_path)
    alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", test_db_url)

    # Run upgrade head
    command.upgrade(alembic_cfg, "head")

    # Verify tables exist using synchronous engine
    engine = create_engine(test_db_url)
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    expected_tables = {
        "projects",
        "users",
        "api_keys",
        "traces",
        "spans",
        "prompt_versions",
        "datasets",
        "dataset_items",
        "eval_runs",
        "eval_results",
        "alert_rules",
        "alert_events",
        "alembic_version",
    }
    assert expected_tables.issubset(set(tables)), f"Missing tables after upgrade: {expected_tables - set(tables)}"

    # Run downgrade base
    command.downgrade(alembic_cfg, "base")

    # Verify all application tables dropped
    inspector = inspect(engine)
    remaining_tables = inspector.get_table_names()
    assert "traces" not in remaining_tables
    assert "spans" not in remaining_tables
    assert "projects" not in remaining_tables

    engine.dispose()
