"""
Скрипт для проверки существующего суперадмина
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from backend.models.models import SuperAdmin

def check_superadmin():
    """Проверить существующего суперадмина"""
    with app.app_context():
        superadmins = SuperAdmin.query.all()
        
        if not superadmins:
            print("[INFO] No super admins found in database")
            return
        
        print("=" * 60)
        print("[INFO] Found super admin(s):")
        print("=" * 60)
        
        for sa in superadmins:
            print(f"   ID: {sa.id}")
            print(f"   Username: {sa.username}")
            print(f"   Full Name: {sa.full_name or 'N/A'}")
            print(f"   Email: {sa.email or 'N/A'}")
            print(f"   Is Active: {sa.is_active}")
            print(f"   Created: {sa.created_at}")
            print(f"   Last Login: {sa.last_login or 'Never'}")
            print("-" * 60)
        
        print("\n[NOTE] Password is stored as hash and cannot be retrieved.")
        print("If you forgot the password, you can:")
        print("1. Delete the super admin from database")
        print("2. Run create_superadmin_auto.py again")
        print("=" * 60)

if __name__ == '__main__':
    check_superadmin()




