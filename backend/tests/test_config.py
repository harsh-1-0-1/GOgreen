from app.core.config import Settings


def test_cors_origins_accepts_single_url():
    settings = Settings(CORS_ORIGINS="https://example.vercel.app")

    assert settings.cors_origins_list == ["https://example.vercel.app"]


def test_cors_origins_accepts_comma_separated_urls():
    settings = Settings(CORS_ORIGINS="https://one.vercel.app, https://two.vercel.app")

    assert settings.cors_origins_list == [
        "https://one.vercel.app",
        "https://two.vercel.app",
    ]


def test_cors_origins_accepts_json_array_string():
    settings = Settings(CORS_ORIGINS='["https://example.vercel.app"]')

    assert settings.cors_origins_list == ["https://example.vercel.app"]
