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
import uuid

from flask_appbuilder import Model
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.schema import UniqueConstraint

from superset.models.helpers import AuditMixinNullable


class ColumnViewScheme(Model, AuditMixinNullable):
    __tablename__ = "superset_column_view_scheme"
    # Scheme names are unique per user and chart for active and deleted rows.
    __table_args__ = (
        UniqueConstraint(
            "chart_id",
            "user_id",
            "name",
            "is_deleted",
            name="uq_column_view_scheme_user_name",
        ),
    )

    id = Column(Integer, primary_key=True)
    uuid = Column(
        String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4())
    )
    chart_id = Column(Integer, ForeignKey("slices.id"), nullable=False, index=True)
    dashboard_id = Column(
        Integer, ForeignKey("dashboards.id"), nullable=True, index=True
    )
    dataset_id = Column(Integer, nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("ab_user.id"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    description = Column(String(512), nullable=True)
    is_default = Column(Boolean, nullable=False, default=False)
    is_deleted = Column(Boolean, nullable=False, default=False)
    state_version = Column(Integer, nullable=False, default=1)
    state_json = Column(Text, nullable=False)
    column_signature = Column(String(128), nullable=True)

    chart = relationship("Slice", foreign_keys=[chart_id])
    dashboard = relationship("Dashboard", foreign_keys=[dashboard_id])
    user = relationship("User", foreign_keys=[user_id])

    def uniqueness_scope(self) -> tuple[int, int, str, bool]:
        return (
            self.chart_id,
            self.user_id,
            self.name,
            self.is_deleted,
        )
