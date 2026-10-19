import sys
import os
import mysql.connector
from mysql.connector import Error

# Reconfigure stdout/stderr on Windows to avoid UnicodeEncodeError
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

DB_CONFIG = {
    "host": os.getenv("DB_HOST", os.getenv("MYSQLHOST", "127.0.0.1")),
    "user": os.getenv("DB_USER", os.getenv("MYSQLUSER", "root")),
    "password": os.getenv("DB_PASSWORD", os.getenv("MYSQLPASSWORD", "")),
    "database": os.getenv("DB_NAME", os.getenv("MYSQLDATABASE", "sales_call_analyzer")),
    "port": int(os.getenv("DB_PORT", os.getenv("MYSQLPORT", 3306)))
}


def get_connection():
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        if connection.is_connected():
            return connection
    except Error as e:
        print("[DB] MySQL connection error:", e)

    return None


def create_tables():
    connection = get_connection()
    if not connection:
        print("[DB] Warning: Cannot connect to MySQL on startup. Tables not verified.")
        return False

    try:
        cursor = connection.cursor()

        # ==========================================
        # USERS TABLE
        # ==========================================
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(150) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ==========================================
        # CALLS TABLE
        # ==========================================
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS calls (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT DEFAULT NULL,
                job_id VARCHAR(100) NOT NULL UNIQUE,
                audio_file VARCHAR(255) NOT NULL,
                report LONGTEXT NOT NULL,
                performance_score INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Ensure user_id column exists if table was created previously without it
        try:
            cursor.execute("SHOW COLUMNS FROM calls LIKE 'user_id'")
            col = cursor.fetchone()
            if not col:
                cursor.execute("ALTER TABLE calls ADD COLUMN user_id INT DEFAULT NULL AFTER id")
                print("[DB] Added user_id column to calls table.")
        except Exception as e:
            print("[DB] Column check notice:", e)

        connection.commit()
        print("[DB] Users and Calls tables verified successfully.")

        cursor.close()
        connection.close()
        return True

    except Error as e:
        print("[DB] Table creation/verification error:", e)
        if connection:
            connection.close()
        return False