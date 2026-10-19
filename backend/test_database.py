from database import get_connection


connection = get_connection()


if connection:
    print("🎉 Database connection is working!")

    connection.close()
else:
    print("❌ Database connection failed.")
