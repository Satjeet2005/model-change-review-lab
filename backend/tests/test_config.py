from app.config import Settings


def test_database_url_normalization():
    s1 = Settings(
        DATABASE_URL="postgres://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"
    )
    assert (
        s1.DATABASE_URL
        == "postgresql+psycopg://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"
    )

    s2 = Settings(
        DATABASE_URL="postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"
    )
    assert (
        s2.DATABASE_URL
        == "postgresql+psycopg://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"
    )

    s3 = Settings(
        DATABASE_URL="postgresql+psycopg://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"
    )
    assert (
        s3.DATABASE_URL
        == "postgresql+psycopg://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"
    )


def test_cors_origin_list():
    s = Settings(CORS_ORIGINS="https://app.pages.dev/ , https://my-frontend.com")
    assert s.cors_origin_list == ["https://app.pages.dev", "https://my-frontend.com"]
