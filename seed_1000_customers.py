import os
import random
import bcrypt
from datetime import datetime, date, timedelta
from decimal import Decimal
from flask import Flask
from db_config import db, get_database_uri, User, Branch, Customer, Account, Transaction, Loan

# Realistic Name Data
MALE_FIRST_NAMES = [
    "Sachin", "Rahul", "Amit", "Rohit", "Aniket", "Nilesh", "Swapnil", "Manoj",
    "Sandeep", "Mahesh", "Vikrant", "Deepak", "Kiran", "Ganesh", "Nitin", "Yogesh",
    "Prashant", "Vijay", "Akshay", "Ajay", "Vishal", "Mayur", "Sagar", "Abhijit",
    "Prathamesh", "Omkar", "Vaibhav", "Tushar", "Saurabh", "Chetan", "Aditya",
    "Devendra", "Rushikesh", "Sanket", "Harshal", "Shrikant", "Amol", "Sunil",
    "Ramesh", "Dinesh", "Prakash", "Santosh", "Ashok", "Kishor", "Sanjay", "Vinod",
    "Anand", "Hemant", "Rohan", "Siddhesh"
]

FEMALE_FIRST_NAMES = [
    "Priya", "Sneha", "Pooja", "Neha", "Tanvi", "Smita", "Shruti", "Sunita",
    "Kavita", "Archana", "Rupali", "Ashwini", "Deepali", "Komal", "Pallavi",
    "Shweta", "Manisha", "Anjali", "Madhuri", "Pratibha", "Rohini", "Payal",
    "Sonali", "Aarti", "Vaishali", "Meena", "Swati", "Poonam", "Ritu", "Rashmi",
    "Kalyani", "Mayuri", "Priyanka", "Tejaswini", "Sayali", "Pranali", "Monika",
    "Sheetal", "Anuradha", "Sarika"
]

LAST_NAMES = [
    "Deshmukh", "Patil", "Kulkarni", "Shinde", "Jadhav", "Joshi", "More", "Pawar",
    "Gaikwad", "Kale", "Chavan", "Thorat", "Tambe", "Navale", "Jagtap", "Bhosale",
    "Salunke", "Sawant", "Ghadge", "Bankar", "Wagh", "Bhor", "Wakchaure", "Shelke",
    "Date", "Gite", "Kotkar", "Lahare", "Kharde", "Landge", "Gunjal", "Pulate",
    "Harde", "Kasar", "Hande", "Sangale", "Dhage", "Malunjkar", "Dighe", "Mandlik",
    "Varpe", "Walunj", "Hase", "Mengal", "Muthe", "Kokane", "Avhad", "Borhade",
    "Shirole", "Bidve"
]

LOCATIONS = [
    "Akole, Ahmednagar", "Main Road, Akole", "Rajur, Akole", "Kotul, Akole",
    "Sangamner, Ahmednagar", "Ghulewadi, Sangamner", "Loni, Rahata", "Shirdi, Ahmednagar",
    "Kopargaon, Ahmednagar", "Rahuri, Ahmednagar", "Savedi, Ahmednagar", "Nagar City, Ahmednagar",
    "Shivajinagar, Pune", "Kothrud, Pune", "Hadapsar, Pune", "Wakad, Pune", "Hinjawadi, Pune",
    "Gangapur Road, Nashik", "Panchavati, Nashik", "College Road, Nashik", "Sinnar, Nashik",
    "Thane West, Thane", "Vashi, Navi Mumbai", "Dadar, Mumbai", "Andheri East, Mumbai"
]

TRANSACTION_DESCRIPTIONS = {
    'Deposit': [
        "Opening Balance Deposit",
        "Monthly Salary Credit",
        "UPI Deposit via GooglePay",
        "NEFT Inward Remittance",
        "Cash Deposit at Akole Branch",
        "Dividend / Interest Credit",
        "Cheque Clearing Credit",
        "Direct Bank Transfer Received",
        "Government Subsidy Credit",
        "Business Inward Receipt"
    ],
    'Withdrawal': [
        "ATM Cash Withdrawal",
        "UPI Payment to Merchant",
        "Electricity Bill Payment - MSEDCL",
        "Mobile & Broadband Recharge",
        "Grocery Store Purchase",
        "Pharmacy & Medical Expense",
        "Petrol Pump Fuel Payment",
        "Online Shopping (Amazon/Flipkart)",
        "NEFT Outward Transfer",
        "Insurance Premium Deduction"
    ]
}

def seed_1000_customers():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = get_database_uri()
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)

    with app.app_context():
        print("Starting 1,000 Customer Account Generation Process...")
        
        # Ensure branch exists
        branch = Branch.query.first()
        if not branch:
            branch = Branch(
                branch_code='ANP01',
                name='Akole Branch',
                address='Main Road, Akole, Ahmednagar - 422601',
                ifsc_code='ANPA0000001'
            )
            db.session.add(branch)
            db.session.commit()
            print("Created default Akole Branch.")

        branch_id = branch.id

        # Compute single bcrypt hash for password 'cust123' to speed up generation
        print("Pre-computing bcrypt hash for 'cust123'...")
        password_hash = bcrypt.hashpw(b'cust123', bcrypt.gensalt()).decode('utf-8')

        # Check existing customer IDs
        existing_users = {u.username for u in User.query.with_entities(User.username).all()}
        existing_cust_ids = {c.customer_id for c in Customer.query.with_entities(Customer.customer_id).all()}
        existing_aadhaars = {c.aadhaar for c in Customer.query.with_entities(Customer.aadhaar).all()}
        existing_pans = {c.pan for c in Customer.query.with_entities(Customer.pan).all()}
        existing_acc_nums = {a.account_number for a in Account.query.with_entities(Account.account_number).all()}

        total_txns_count = Transaction.query.count()

        new_users = []
        new_customers = []
        new_accounts = []
        new_transactions = []
        new_loans = []

        start_id = 1001
        target_count = 1000
        created = 0

        print(f"Generating {target_count} unique customer profiles...")

        # Base dates
        start_date = datetime(2026, 1, 1)
        end_date = datetime(2026, 9, 8)
        delta_days = (end_date - start_date).days

        # Pre-seed random generator for reproducibility
        rng = random.Random(42)

        for i in range(target_count):
            curr_num = start_id + i
            username = f"cust{curr_num}"
            while username in existing_users:
                curr_num += 1
                username = f"cust{curr_num}"
            existing_users.add(username)

            cust_id = f"CUST{curr_num}"
            acc_num = f"1000000{curr_num:05d}"
            while acc_num in existing_acc_nums:
                curr_num += 1
                acc_num = f"1000000{curr_num:05d}"
            existing_acc_nums.add(acc_num)

            # Generate Gender & Name
            gender = rng.choice(["Male", "Female"])
            if gender == "Male":
                first_name = rng.choice(MALE_FIRST_NAMES)
            else:
                first_name = rng.choice(FEMALE_FIRST_NAMES)
            last_name = rng.choice(LAST_NAMES)
            full_name = f"{first_name} {last_name}"

            # Unique Mobile
            mobile_prefix = rng.choice(["98", "97", "99", "96", "95", "94", "93", "91", "88", "87", "86", "84", "82", "77", "70"])
            mobile = f"{mobile_prefix}{rng.randint(10000000, 99999999)}"

            # Unique Email
            email_clean = full_name.lower().replace(" ", ".")
            email = f"{email_clean}{curr_num % 1000}@gmail.com"

            # Unique Aadhaar: 12 digits formatted as XXXX-XXXX-XXXX
            p1 = rng.randint(2000, 9999)
            p2 = rng.randint(1000, 9999)
            p3 = rng.randint(1000, 9999)
            aadhaar = f"{p1}-{p2}-{p3}"
            while aadhaar in existing_aadhaars:
                p3 = rng.randint(1000, 9999)
                aadhaar = f"{p1}-{p2}-{p3}"
            existing_aadhaars.add(aadhaar)

            # Unique PAN: 5 uppercase letters + 4 digits + 1 uppercase letter
            pan_letters = "".join(rng.choices("ABCDEFGHJKLMNPQRSTUVWXYZ", k=5))
            pan_digits = f"{rng.randint(1000, 9999)}"
            pan_last = rng.choice("ABCDEFGHJKLMNPQRSTUVWXYZ")
            pan = f"{pan_letters}{pan_digits}{pan_last}"
            while pan in existing_pans:
                pan_digits = f"{rng.randint(1000, 9999)}"
                pan = f"{pan_letters}{pan_digits}{pan_last}"
            existing_pans.add(pan)

            # Date of Birth (Age between 20 and 65)
            birth_year = rng.randint(1960, 2005)
            birth_month = rng.randint(1, 12)
            birth_day = rng.randint(1, 28)
            dob = date(birth_year, birth_month, birth_day)

            address = rng.choice(LOCATIONS)
            account_type = rng.choices(["Savings", "Current", "Salary"], weights=[75, 20, 5])[0]

            # Account Creation Date (staggered in 2026)
            days_offset = rng.randint(0, delta_days - 10)
            acc_created_at = start_date + timedelta(days=days_offset, hours=rng.randint(9, 17))

            # Initial balance
            initial_balance = Decimal(str(round(rng.uniform(2000.0, 150000.0), 2)))

            # 1. Create User
            user = User(
                username=username,
                password_hash=password_hash,
                role='customer',
                created_at=acc_created_at
            )
            db.session.add(user)
            db.session.flush() # get user.id

            # 2. Create Customer
            customer = Customer(
                user_id=user.id,
                customer_id=cust_id,
                name=full_name,
                dob=dob,
                gender=gender,
                mobile=mobile,
                email=email,
                aadhaar=aadhaar,
                pan=pan,
                address=address,
                status='Active'
            )
            db.session.add(customer)
            db.session.flush() # get customer.id

            # 3. Create Account
            account = Account(
                account_number=acc_num,
                customer_id=customer.id,
                account_type=account_type,
                branch_id=branch_id,
                balance=initial_balance,
                status='Active',
                created_at=acc_created_at
            )
            db.session.add(account)
            db.session.flush() # get account.id

            # 4. Generate 2 to 5 Realistic Transactions
            num_txns = rng.randint(2, 5)
            current_bal = Decimal("0.00")
            
            # First transaction: Opening Balance Deposit
            total_txns_count += 1
            t1 = Transaction(
                transaction_id=f"TXN{10000 + total_txns_count}",
                account_id=account.id,
                type='Deposit',
                amount=initial_balance,
                description='Account Opening Cash Deposit',
                payment_mode='Cash',
                created_at=acc_created_at
            )
            db.session.add(t1)
            current_bal = initial_balance

            # Subsequent Transactions
            for tx_i in range(1, num_txns):
                total_txns_count += 1
                tx_date = acc_created_at + timedelta(
                    days=rng.randint(1, max(1, (end_date - acc_created_at).days)),
                    hours=rng.randint(0, 12),
                    minutes=rng.randint(0, 59)
                )
                
                # If balance is healthy, can withdraw or deposit
                if current_bal > Decimal("3000.00") and rng.random() > 0.4:
                    tx_type = 'Withdrawal'
                    max_with = min(float(current_bal) - 1000.0, 25000.0)
                    amt = Decimal(str(round(rng.uniform(200.0, max(500.0, max_with)), 2)))
                    current_bal -= amt
                    desc = rng.choice(TRANSACTION_DESCRIPTIONS['Withdrawal'])
                    mode = rng.choices(["Online Transfer", "Cash", "UPI", "Cheque"], weights=[40, 30, 25, 5])[0]
                else:
                    tx_type = 'Deposit'
                    amt = Decimal(str(round(rng.uniform(1000.0, 50000.0), 2)))
                    current_bal += amt
                    desc = rng.choice(TRANSACTION_DESCRIPTIONS['Deposit'])
                    mode = rng.choices(["Cash", "Online Transfer", "Cheque"], weights=[45, 45, 10])[0]

                txn = Transaction(
                    transaction_id=f"TXN{10000 + total_txns_count}",
                    account_id=account.id,
                    type=tx_type,
                    amount=amt,
                    description=desc,
                    payment_mode=mode,
                    created_at=tx_date
                )
                db.session.add(txn)

            # Update final balance
            account.balance = current_bal

            # 5. Seed some Loan applications (~15% of customers)
            if rng.random() < 0.15:
                loan_type = rng.choice(["Personal Loan", "Home Loan", "Vehicle Loan", "Agriculture Loan", "Business Loan"])
                loan_amt = Decimal(str(rng.randint(50, 500) * 1000))
                duration = rng.choice([12, 24, 36, 48, 60, 84])
                loan_status = rng.choices(["Approved", "Pending", "Rejected"], weights=[60, 30, 10])[0]
                loan_num = 2000 + len(new_loans) + 1
                loan_id = f"LOAN{loan_num}"
                
                loan = Loan(
                    loan_id=loan_id,
                    customer_id=customer.id,
                    loan_type=loan_type,
                    amount=loan_amt,
                    duration_months=duration,
                    status=loan_status,
                    created_at=acc_created_at + timedelta(days=rng.randint(2, 20))
                )
                db.session.add(loan)
                new_loans.append(loan)

            created += 1
            if created % 100 == 0:
                db.session.commit()
                print(f"Committed {created} / {target_count} customer accounts...")

        db.session.commit()
        print("="*60)
        print(f"SUCCESS! Successfully seeded {created} customer accounts!")
        print(f"Total Customers in Database: {Customer.query.count()}")
        print(f"Total Accounts in Database: {Account.query.count()}")
        print(f"Total Transactions in Database: {Transaction.query.count()}")
        print(f"Total Loans in Database: {Loan.query.count()}")
        print("="*60)

if __name__ == '__main__':
    seed_1000_customers()
