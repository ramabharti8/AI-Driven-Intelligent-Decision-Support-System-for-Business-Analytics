"""End-to-end API checks with a throwaway database."""
import os
import tempfile

import pytest

os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["WARM_MODELS"] = "0"

from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402
from ml_engine import data_engine  # noqa: E402

pytestmark = pytest.mark.skipif(not os.path.exists(data_engine.DATA_PATH), reason="cleaned dataset not prepared")


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        token = c.post("/api/auth/login", json={"email": "user@demo.com", "password": "user123"}).json()["access_token"]
        c.headers.update({"Authorization": f"Bearer {token}"})
        yield c


def test_requires_login():
    with TestClient(app) as c:
        assert c.get("/api/analytics/dashboard").status_code == 401


@pytest.mark.parametrize("path", [
    "/api/analytics/dashboard", "/api/analytics/monthly", "/api/analytics/countries",
    "/api/analytics/products", "/api/analytics/heatmap", "/api/analytics/forecast",
    "/api/decisions/segments", "/api/decisions/churn", "/api/decisions/at-risk",
    "/api/decisions/retention-plan?contact_cost=8&save_rate=0.25", "/api/insights/",
])
def test_endpoints_ok(client, path):
    r = client.get(path)
    assert r.status_code == 200, r.text


def test_train_then_predict(client):
    r = client.post("/api/ml/train", json={"algorithm": "gradient_boosting", "target_column": "revenue_category",
                                           "task_type": "classification"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "Revenue" in {d["column"] for d in body["dropped_columns"]}
    p = client.post("/api/ml/predict", json={"prediction_id": body["prediction_id"],
                                             "input_data": {"Product_Category": "Software", "Units_Sold": 10,
                                                            "Unit_Price": 2499.99, "Region": "East"}})
    assert p.status_code == 200, p.text


def test_report_generation(client):
    for kind in ("pdf", "excel"):
        r = client.post("/api/reports/generate", json={"title": "Test", "report_type": kind})
        assert r.status_code == 200, r.text
        d = client.get(f"/api/reports/{r.json()['id']}/download")
        assert d.status_code == 200 and len(d.content) > 1000


def test_chat_answers_with_numbers(client):
    r = client.post("/api/insights/chat", json={"message": "what is our churn?"})
    assert r.status_code == 200
    assert "%" in r.json()["response"]
