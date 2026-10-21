import os, pymysql
from dotenv import load_dotenv
load_dotenv()

def conn():
    return pymysql.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"), port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("DB_USER", "root"), password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "weather_disaster"),
        cursorclass=pymysql.cursors.DictCursor, autocommit=True)

def query(sql, args=(), one=False):
    c = conn()
    try:
        with c.cursor() as cur:
            cur.execute(sql, args)
            if cur.description is None:
                return cur.lastrowid
            return cur.fetchone() if one else cur.fetchall()
    finally:
        c.close()
