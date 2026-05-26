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
from types import SimpleNamespace

import pytest
from flask import g
from pytest_mock import MockerFixture

from superset.column_view_scheme.models import ColumnViewScheme
from tests.unit_tests.conftest import with_feature_flags


STATE = {
    "state_version": 1,
    "viz_type": "ag-grid-table-scheme",
    "state_type": "column_view",
    "columns": [{"colId": "name"}],
    "raw_column_state": [{"colId": "name"}],
}


@pytest.fixture
def api_user(app):
    def set_user():
        g.user = SimpleNamespace(id=1, is_anonymous=False)

    app.before_request_funcs.setdefault(None, []).append(set_user)
    yield
    app.before_request_funcs[None].remove(set_user)


def api_scheme(**overrides):
    data = {
        "id": 1,
        "uuid": "8e81731e-9db7-4f6a-a616-268d479cbb99",
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
        "column_signature": None,
    }
    data.update(overrides)
    return ColumnViewScheme(**data)


@pytest.fixture
def chart_access(mocker: MockerFixture):
    chart = SimpleNamespace(id=10)
    mocker.patch(
        "superset.column_view_scheme.api.ChartDAO.get_by_id_or_uuid",
        return_value=chart,
    )
    mocker.patch(
        "superset.column_view_scheme.api.security_manager.can_access_chart",
        return_value=True,
    )


@with_feature_flags(COLUMN_VIEW_SCHEME_ENABLED=True)
def test_get_returns_current_users_schemes(
    client,
    full_api_access,
    api_user,
    chart_access,
    mocker: MockerFixture,
) -> None:
    find_all = mocker.patch(
        "superset.column_view_scheme.api.ColumnViewSchemeDAO.find_all_for_user",
        return_value=[api_scheme(name="mine")],
    )

    response = client.get("/api/v1/column_view_scheme/?chart_id=10")

    assert response.status_code == 200
    find_all.assert_called_once_with(10, None, 1)
    assert response.json["result"][0]["name"] == "mine"


@with_feature_flags(COLUMN_VIEW_SCHEME_ENABLED=True)
def test_post_creates_scheme_for_current_user(
    client,
    full_api_access,
    api_user,
    chart_access,
    mocker: MockerFixture,
) -> None:
    command = mocker.patch(
        "superset.column_view_scheme.api.CreateColumnViewSchemeCommand"
    )
    command.return_value.run.return_value = api_scheme()

    response = client.post(
        "/api/v1/column_view_scheme/",
        json={
            "chart_id": 10,
            "name": "Default view",
            "state": STATE,
        },
    )

    assert response.status_code == 201
    command.assert_called_once()
    assert command.call_args.args[1] == 1
    assert response.json["result"]["state"] == STATE


@with_feature_flags(COLUMN_VIEW_SCHEME_ENABLED=True)
def test_put_returns_404_for_foreign_owner_scheme(
    client,
    full_api_access,
    api_user,
    mocker: MockerFixture,
) -> None:
    mocker.patch(
        "superset.column_view_scheme.api.ColumnViewSchemeDAO.find_by_id_for_user",
        return_value=None,
    )
    command = mocker.patch(
        "superset.column_view_scheme.api.UpdateColumnViewSchemeCommand"
    )

    response = client.put(
        "/api/v1/column_view_scheme/2",
        json={"name": "Updated view"},
    )

    assert response.status_code == 404
    command.assert_not_called()


@with_feature_flags(COLUMN_VIEW_SCHEME_ENABLED=True)
def test_delete_requires_chart_access_before_command(
    client,
    full_api_access,
    api_user,
    mocker: MockerFixture,
) -> None:
    chart = SimpleNamespace(id=10)
    mocker.patch(
        "superset.column_view_scheme.api.ColumnViewSchemeDAO.find_by_id_for_user",
        return_value=api_scheme(),
    )
    mocker.patch(
        "superset.column_view_scheme.api.ChartDAO.get_by_id_or_uuid",
        return_value=chart,
    )
    can_access_chart = mocker.patch(
        "superset.column_view_scheme.api.security_manager.can_access_chart",
        return_value=False,
    )
    command = mocker.patch(
        "superset.column_view_scheme.api.DeleteColumnViewSchemeCommand"
    )

    response = client.delete("/api/v1/column_view_scheme/1")

    assert response.status_code == 403
    can_access_chart.assert_called_once_with(chart)
    command.assert_not_called()


@with_feature_flags(COLUMN_VIEW_SCHEME_ENABLED=False)
def test_feature_flag_disabled_returns_404(
    client,
    full_api_access,
    api_user,
) -> None:
    response = client.get("/api/v1/column_view_scheme/?chart_id=10")

    assert response.status_code == 404
