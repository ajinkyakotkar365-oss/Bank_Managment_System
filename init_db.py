import os
import bcrypt
from datetime import datetime, date
from flask import Flask
from db_config import db, get_database_uri, User, Branch, Employee, Customer, Account, Transaction, Loan

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def init_database():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = get_database_uri()
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize app with db
    db.init_app(app)
    
    with app.app_context():
        print(f"Initializing database using URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
        
        # Drop and recreate for a clean slate
        db.drop_all()
        db.create_all()
        print("Database tables created.")
        
        # 1. Create Users
        # Admin User
        admin_user = User(username='admin', password_hash=hash_password('admin123'), role='admin')
        db.session.add(admin_user)
        
        # Employee User (Cashier)
        emp_user = User(username='cashier', password_hash=hash_password('cashier123'), role='employee')
        db.session.add(emp_user)
        
        # Customer User
        cust_user = User(username='customer', password_hash=hash_password('cust123'), role='customer')
        db.session.add(cust_user)
        
        # Flush to get user IDs
        db.session.flush()
        
        # 2. Create Branches (Only One Branch for Ajinkya Bank)
        b1 = Branch(branch_code='ANP01', name='Akole Branch', address='Main Road, Akole, Ahmednagar', ifsc_code='ANPA0000001')
        db.session.add(b1)
        db.session.flush()
        
        # 3. Create Employees
        e1 = Employee(
            user_id=emp_user.id,
            employee_id='EMP01',
            name='Akole Cashier',
            role='Teller',
            branch_id=b1.id,
            mobile='9876543210',
            email='cashier@ajinkyabank.com',
            status='Active'
        )
        db.session.add(e1)
        
        # 4. Create Customers
        c1 = Customer(
            user_id=cust_user.id,
            customer_id='CUST101',
            name='Rahul Sharma',
            dob=date(1995, 8, 15),
            gender='Male',
            mobile='9836543210',
            email='rahul@gmail.com',
            aadhaar='1234-5678-9012',
            pan='ABCDE1234F',
            address='Akole, Ahmednagar',
            status='Active'
        )
        db.session.add(c1)
        db.session.flush()
        
        # 5. Create Accounts (Starting with 0 Balance)
        a1 = Account(
            account_number='100000007890',
            customer_id=c1.id,
            account_type='Savings',
            branch_id=b1.id,
            balance=0.00,
            status='Active'
        )
        db.session.add(a1)
        
        db.session.commit()
        print("Data seeded successfully!")

if __name__ == '__main__':
    init_database()
