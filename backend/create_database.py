from database import create_tables


print("Creating database tables...")

if create_tables():
    print("🎉 Database setup completed!")
else:
    print("❌ Database setup failed.")