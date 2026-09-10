import os
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Numeric
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

db = SQLAlchemy()

def get_database_uri():
    db_type = os.getenv('DB_TYPE', 'sqlite')
    if db_type == 'mysql':
        user = os.getenv('DB_USER', 'root')
        password = os.getenv('DB_PASSWORD', '')
        host = os.getenv('DB_HOST', 'localhost')
        port = os.getenv('DB_PORT', '3306')
        name = os.getenv('DB_NAME', 'bank_db')
        return f"mysql+mysqlconnector://{user}:{password}@{host}:{port}/{name}"
    elif db_type == 'postgresql':
        user = os.getenv('DB_USER', 'postgres')
        password = os.getenv('DB_PASSWORD', '')
        host = os.getenv('DB_HOST', 'localhost')
        port = os.getenv('DB_PORT', '5432')
        name = os.getenv('DB_NAME', 'bank_db')
        return f"postgresql://{user}:{password}@{host}:{port}/{name}"
    else:
        return "sqlite:///bank.db"


# Database Models
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # admin, employee, customer
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    employee = db.relationship('Employee', backref='user', uselist=False, cascade="all, delete-orphan")
    customer = db.relationship('Customer', backref='user', uselist=False, cascade="all, delete-orphan")

class Branch(db.Model):
    __tablename__ = 'branches'
    id = db.Column(db.Integer, primary_key=True)
    branch_code = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(255), nullable=False)
    ifsc_code = db.Column(db.String(20), unique=True, nullable=False)

    # Relationships
    employees = db.relationship('Employee', backref='branch', lazy=True)
    accounts = db.relationship('Account', backref='branch', lazy=True)

class Employee(db.Model):
    __tablename__ = 'employees'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    employee_id = db.Column(db.String(20), unique=True, nullable=False)  # e.g., EMP01
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(50), nullable=False)  # Manager, Teller, Loan Officer
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False)
    mobile = db.Column(db.String(15), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), default='Active')  # Active, Inactive

class Customer(db.Model):
    __tablename__ = 'customers'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    customer_id = db.Column(db.String(20), unique=True, nullable=False)  # e.g., CUST101
    name = db.Column(db.String(100), nullable=False)
    dob = db.Column(db.Date, nullable=False)
    gender = db.Column(db.String(10), nullable=False)
    mobile = db.Column(db.String(15), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    aadhaar = db.Column(db.String(20), unique=True, nullable=False)
    pan = db.Column(db.String(20), unique=True, nullable=False)
    address = db.Column(db.String(255), nullable=False)
    status = db.Column(db.String(20), default='Active')  # Active, Inactive

    # Relationships
    accounts = db.relationship('Account', backref='customer', lazy=True, cascade="all, delete-orphan")
    loans = db.relationship('Loan', backref='customer', lazy=True, cascade="all, delete-orphan")

class Account(db.Model):
    __tablename__ = 'accounts'
    id = db.Column(db.Integer, primary_key=True)
    account_number = db.Column(db.String(20), unique=True, nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id', ondelete='CASCADE'), nullable=False)
    account_type = db.Column(db.String(20), nullable=False)  # Savings, Current, Fixed Deposit
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'), nullable=False)
    balance = db.Column(Numeric(15, 2), default=0.00)
    status = db.Column(db.String(20), default='Active')  # Active, Inactive
    authorized_by = db.Column(db.String(100), nullable=True)  # Branch Authority
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    transactions = db.relationship('Transaction', backref='account', lazy=True, cascade="all, delete-orphan")

class Transaction(db.Model):
    __tablename__ = 'transactions'
    id = db.Column(db.Integer, primary_key=True)
    transaction_id = db.Column(db.String(30), unique=True, nullable=False)  # e.g., TXN10001
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id', ondelete='CASCADE'), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # Deposit, Withdrawal, Transfer
    amount = db.Column(Numeric(15, 2), nullable=False)
    description = db.Column(db.String(255), nullable=False)
    payment_mode = db.Column(db.String(20), nullable=False)  # Cash, Cheque, Online
    related_account_number = db.Column(db.String(20), nullable=True)  # For transfers
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Loan(db.Model):
    __tablename__ = 'loans'
    id = db.Column(db.Integer, primary_key=True)
    loan_id = db.Column(db.String(20), unique=True, nullable=False)  # e.g., LOAN1001
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id', ondelete='CASCADE'), nullable=False)
    loan_type = db.Column(db.String(50), nullable=False)  # Personal, Home, Car, Education
    amount = db.Column(Numeric(15, 2), nullable=False)
    duration_months = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), default='Pending')  # Pending, Approved, Rejected
    approved_by = db.Column(db.String(100), nullable=True)  # Bank Authority / Loan Officer
    approved_at = db.Column(db.DateTime, nullable=True)
    approval_ref = db.Column(db.String(40), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class SMSAlert(db.Model):
    __tablename__ = 'sms_alerts'
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id', ondelete='CASCADE'), nullable=True)
    mobile = db.Column(db.String(15), nullable=False)
    message = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class DebitCard(db.Model):
    __tablename__ = 'debit_cards'
    id = db.Column(db.Integer, primary_key=True)
    card_number = db.Column(db.String(25), unique=True, nullable=True)
    account_id = db.Column(db.Integer, db.ForeignKey('accounts.id', ondelete='CASCADE'), nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id', ondelete='CASCADE'), nullable=False)
    cardholder_name = db.Column(db.String(100), nullable=False)
    expiry_month = db.Column(db.String(2), default='12')
    expiry_year = db.Column(db.String(4), default='2029')
    cvv = db.Column(db.String(4), nullable=True)
    pin = db.Column(db.String(10), default='1234')
    card_type = db.Column(db.String(50), default='RuPay Platinum Virtual')
    
    # Banking Authority & Real-Time Lifecycle
    status = db.Column(db.String(30), default='Pending_Approval')  # Pending_Approval, Active, Frozen, Blocked, Rejected
    authorized_by = db.Column(db.String(100), nullable=True)      # Bank Authority / Manager
    authorized_at = db.Column(db.DateTime, nullable=True)
    approval_ref = db.Column(db.String(40), nullable=True)        # Official reference: AUTH-VDC-2026-XXXX
    rejection_reason = db.Column(db.String(255), nullable=True)
    card_token = db.Column(db.String(64), unique=True, nullable=True) # RBI Tokenization standard
    
    daily_atm_limit = db.Column(Numeric(15, 2), default=50000.00)
    daily_pos_limit = db.Column(Numeric(15, 2), default=100000.00)
    is_online_enabled = db.Column(db.Boolean, default=True)
    is_contactless_enabled = db.Column(db.Boolean, default=True)
    is_international_enabled = db.Column(db.Boolean, default=False)
    applied_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    customer = db.relationship('Customer', backref=db.backref('debit_cards', lazy=True, cascade="all, delete-orphan"))
    account = db.relationship('Account', backref=db.backref('debit_cards', lazy=True, cascade="all, delete-orphan"))


if __name__ == '__main__':
    from flask import Flask
    from sqlalchemy import inspect

    test_app = Flask(__name__)
    test_app.config['SQLALCHEMY_DATABASE_URI'] = get_database_uri()
    test_app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(test_app)

    with test_app.app_context():
        try:
            with db.engine.connect() as conn:
                inspector = inspect(conn)
                tables = inspector.get_table_names()
                print("=" * 50)
                print("  Database Connection: SUCCESSFUL")
                print(f"  URI: {test_app.config['SQLALCHEMY_DATABASE_URI']}")
                print(f"  Configured Tables ({len(tables)}): {', '.join(tables)}")
                print("=" * 50)
        except Exception as err:
            print("=" * 50)
            print("  Database Connection: FAILED")
            print(f"  Error: {err}")
            print("=" * 50)
