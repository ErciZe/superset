# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
from __future__ import annotations

import json

import pytest

from superset.column_view_scheme.commands.create import CreateColumnViewSchemeCommand
from superset.column_view_scheme.commands.delete import DeleteColumnViewSchemeCommand
from superset.column_view_scheme.commands.exceptions import (
    ColumnViewSchemeForbiddenError,
    ColumnViewSchemeInvalidError,
)
from superset.column_view_scheme.commands.set_default import (
    SetDefaultColumnViewSchemeCommand,
)
from superset.column_view_scheme.commands.update import UpdateColumnViewSchemeCommand
from superset.column_view_scheme.dao import ColumnViewSchemeDAO
from superset.column_view_scheme.models import ColumnViewScheme
from superset.extensions import db


STATE = {
    "state_version": 1,
    "viz_type": "ag-grid-table-scheme",
    "state_type": "column_view",
    "column_signature": "abc",
    "columns": [{"colId": "name"}],
    "raw_column_state": [{"colId": "name", "hide": False}],
}


@pytest.fixture
def column_view_scheme_table(session):
    ColumnViewScheme.metadata.create_all(bind=session.get_bind())
    yield
    session.query(ColumnViewScheme).delete()
    session.commit()


def scheme(**overrides):
    data = {
        "chart_id": 10,
        "dashboard_id": None,
        "dataset_id": 100,
        "user_id": 1,
        "name": "Default view",
        "description": None,
        "is_default": False,
        "is_deleted": False,
        "state_version": 1,
        "state_json": json.dumps(STATE),
        "column_signature": "abc",
    }
    data.update(overrides)
    return ColumnViewScheme(**data)


def create_payload(**overrides):
    data = {
        "chart_id": 10,
        "dashboard_id": None,
        "dataset_id": 100,
        "name": "Default view",
        "description": "Visible columns",
        "is_default": False,
        "state": STATE,
    }
    data.update(overrides)
    return data


def test_unique_constraint_matches_name_scope() -> None:
    constraint = next(
        item
        for item in ColumnViewScheme.__table__.constraints
        if item.name == "uq_column_view_scheme_user_name"
    )

    assert [column.name for column in constraint.columns] == [
        "chart_id",
        "user_id",
        "name",
        "is_deleted",
    ]


def test_find_all_for_user_returns_current_users_non_deleted_schemes(
    column_view_scheme_table,
) -> None:
    db.session.add(scheme(name="mine", user_id=1))
    db.session.add(scheme(name="other user", user_id=2))
    db.session.add(scheme(name="deleted", user_id=1, is_deleted=True))
    db.session.commit()

    result = ColumnViewSchemeDAO.find_all_for_user(10, None, 1)

    assert [item.name for item in result] == ["mine"]


def test_find_by_id_for_user_returns_only_current_users_active_scheme(
    column_view_scheme_table,
) -> None:
    db.session.add(scheme(name="mine", user_id=1))
    db.session.add(scheme(name="other user", user_id=2))
    db.session.add(scheme(name="deleted", user_id=1, is_deleted=True))
    db.session.commit()
    mine, other, deleted = db.session.query(ColumnViewScheme).order_by(
        ColumnViewScheme.id
    )

    assert ColumnViewSchemeDAO.find_by_id_for_user(mine.id, 1) == mine
    assert ColumnViewSchemeDAO.find_by_id_for_user(other.id, 1) is None
    assert ColumnViewSchemeDAO.find_by_id_for_user(deleted.id, 1) is None


def test_find_default_prefers_dashboard_scope_over_chart_level(
    column_view_scheme_table,
) -> None:
    db.session.add(scheme(name="chart default", is_default=True))
    db.session.add(scheme(name="dashboard default", dashboard_id=20, is_default=True))
    db.session.commit()

    result = ColumnViewSchemeDAO.find_default(10, 20, 1)

    assert result.name == "dashboard default"


def test_create_rejects_duplicate_active_name_when_dashboard_id_is_none(
    column_view_scheme_table,
) -> None:
    db.session.add(scheme(name="Default view", dashboard_id=None))
    db.session.commit()

    with pytest.raises(ColumnViewSchemeInvalidError):
        CreateColumnViewSchemeCommand(create_payload(dashboard_id=None), 1).run()


def test_create_rejects_duplicate_active_name_in_dashboard_scope(
    column_view_scheme_table,
) -> None:
    db.session.add(scheme(name="Default view", dashboard_id=20))
    db.session.commit()

    with pytest.raises(ColumnViewSchemeInvalidError):
        CreateColumnViewSchemeCommand(create_payload(dashboard_id=20), 1).run()


def test_create_rejects_duplicate_active_name_across_dashboard_scopes(
    column_view_scheme_table,
) -> None:
    db.session.add(scheme(name="Default view", dashboard_id=20))
    db.session.commit()

    with pytest.raises(ColumnViewSchemeInvalidError):
        CreateColumnViewSchemeCommand(create_payload(dashboard_id=30), 1).run()


def test_post_command_creates_scheme_for_current_user(
    column_view_scheme_table,
) -> None:
    result = CreateColumnViewSchemeCommand(create_payload(), 1).run()

    assert result.user_id == 1
    assert result.column_signature == "abc"
    assert json.loads(result.state_json) == STATE


def test_update_rejects_another_users_scheme(column_view_scheme_table) -> None:
    db.session.add(scheme(user_id=2))
    db.session.commit()
    existing = db.session.query(ColumnViewScheme).one()

    with pytest.raises(ColumnViewSchemeForbiddenError):
        UpdateColumnViewSchemeCommand(existing.id, {"name": "Updated"}, 1).run()


def test_delete_soft_deletes_and_clears_default(column_view_scheme_table) -> None:
    db.session.add(scheme(is_default=True))
    db.session.commit()
    existing = db.session.query(ColumnViewScheme).one()
    original_id = existing.id

    DeleteColumnViewSchemeCommand(existing.id, 1).run()

    assert existing.is_deleted is True
    assert existing.is_default is False
    assert existing.name == f"Default view__deleted__{original_id}"


def test_delete_releases_dashboard_scoped_name_for_repeated_recreate(
    column_view_scheme_table,
) -> None:
    original_name = "A" * 128
    first = CreateColumnViewSchemeCommand(
        create_payload(name=original_name, dashboard_id=20),
        1,
    ).run()
    first_id = first.id

    DeleteColumnViewSchemeCommand(first.id, 1).run()
    second = CreateColumnViewSchemeCommand(
        create_payload(name=original_name, dashboard_id=20),
        1,
    ).run()
    second_id = second.id

    DeleteColumnViewSchemeCommand(second.id, 1).run()

    deleted_names = [
        row.name
        for row in db.session.query(ColumnViewScheme)
        .filter(
            ColumnViewScheme.dashboard_id == 20,
            ColumnViewScheme.is_deleted.is_(True),
        )
        .order_by(ColumnViewScheme.id)
    ]
    first_suffix = f"__deleted__{first_id}"
    second_suffix = f"__deleted__{second_id}"
    assert deleted_names == [
        f"{original_name[:128 - len(first_suffix)]}{first_suffix}",
        f"{original_name[:128 - len(second_suffix)]}{second_suffix}",
    ]
    assert len(set(deleted_names)) == 2
    assert all(len(name) <= 128 for name in deleted_names)


def test_set_default_clears_previous_default_in_same_scope(
    column_view_scheme_table,
) -> None:
    db.session.add(scheme(name="old", is_default=True))
    db.session.add(scheme(name="new", is_default=False))
    db.session.commit()
    old, new = db.session.query(ColumnViewScheme).order_by(ColumnViewScheme.id).all()

    result = SetDefaultColumnViewSchemeCommand(new.id, 1).run()

    assert result.id == new.id
    assert new.is_default is True
    assert old.is_default is False
