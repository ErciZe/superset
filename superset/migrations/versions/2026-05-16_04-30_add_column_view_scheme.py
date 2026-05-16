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
"""add column view scheme

Revision ID: 20260516_0430
Revises: c233f5365c9e
Create Date: 2026-05-16 04:30:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "20260516_0430"
down_revision = "c233f5365c9e"

table_name = "superset_column_view_scheme"


def upgrade():
    op.create_table(
        table_name,
        sa.Column("created_on", sa.DateTime(), nullable=True),
        sa.Column("changed_on", sa.DateTime(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column("chart_id", sa.Integer(), nullable=False),
        sa.Column("dashboard_id", sa.Integer(), nullable=True),
        sa.Column("dataset_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("description", sa.String(length=512), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("state_version", sa.Integer(), nullable=False),
        sa.Column("state_json", sa.Text(), nullable=False),
        sa.Column("column_signature", sa.String(length=128), nullable=True),
        sa.Column("created_by_fk", sa.Integer(), nullable=True),
        sa.Column("changed_by_fk", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["changed_by_fk"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["chart_id"], ["slices.id"]),
        sa.ForeignKeyConstraint(["created_by_fk"], ["ab_user.id"]),
        sa.ForeignKeyConstraint(["dashboard_id"], ["dashboards.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["ab_user.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "chart_id",
            "dashboard_id",
            "user_id",
            "name",
            "is_deleted",
            name="uq_column_view_scheme_user_name",
        ),
        sa.UniqueConstraint("uuid"),
    )
    op.create_index("ix_column_view_scheme_chart_id", table_name, ["chart_id"])
    op.create_index(
        "ix_column_view_scheme_dashboard_id", table_name, ["dashboard_id"]
    )
    op.create_index("ix_column_view_scheme_dataset_id", table_name, ["dataset_id"])
    op.create_index("ix_column_view_scheme_user_id", table_name, ["user_id"])


def downgrade():
    op.drop_index("ix_column_view_scheme_user_id", table_name=table_name)
    op.drop_index("ix_column_view_scheme_dataset_id", table_name=table_name)
    op.drop_index("ix_column_view_scheme_dashboard_id", table_name=table_name)
    op.drop_index("ix_column_view_scheme_chart_id", table_name=table_name)
    op.drop_table(table_name)
