import os
import random
import bcrypt
from datetime import datetime, date
from decimal import Decimal
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from db_config import db, get_database_uri, User, Branch, Employee, Customer, Account, Transaction, Loan, SMSAlert, DebitCard

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'bank_management_super_secret_key')
app.config['SQLALCHEMY_DATABASE_URI'] = get_database_uri()
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Helper Functions & Decorators
def get_logged_in_user():
    if 'user_id' not in session:
        return None
    return User.query.get(session['user_id'])

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access this page.', 'danger')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def roles_allowed(*roles):
    def decorator(f):
        from functools import wraps
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'role' not in session or session['role'] not in roles:
                flash('You do not have permission to view this page.', 'danger')
                return redirect(url_for('login'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Custom filters for template rendering
@app.template_filter('format_currency')
def format_currency(value):
    try:
        val = float(value)
        # Indian formatting (Lakhs/Crores)
        s, d = str(val).split('.') if '.' in str(val) else (str(val), '00')
        if len(d) == 1:
            d += '0'
        d = d[:2]
        
        last_three = s[-3:]
        other_parts = s[:-3]
        if other_parts:
            formatted = ''
            # Process groups of two digits from right to left
            while len(other_parts) > 2:
                formatted = ',' + other_parts[-2:] + formatted
                other_parts = other_parts[:-2]
            if other_parts:
                formatted = other_parts + formatted
            return '₹' + formatted + ',' + last_three + '.' + d
        else:
            return '₹' + last_three + '.' + d
    except (ValueError, TypeError):
        return '₹' + str(value)

@app.template_filter('format_date')
def format_date(value):
    if not value:
        return ""
    if isinstance(value, str):
        try:
            value = datetime.strptime(value, '%Y-%m-%d')
        except ValueError:
            return value
    return value.strftime('%d %b %Y')

# Authentication routes
# Authentication routes
@app.route('/')
def index():
    if 'user_id' in session and 'role' in session:
        if session['role'] == 'admin':
            return redirect(url_for('admin_dashboard'))
        elif session['role'] == 'employee':
            return redirect(url_for('employee_teller_desk'))
        elif session['role'] == 'customer':
            return redirect(url_for('customer_dashboard'))
    return redirect(url_for('login'))

@app.route('/portal')
@login_required
def portal():
    return render_template('portal.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = User.query.filter_by(username=username).first()
        if user and bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
            session['user_id'] = user.id
            session['username'] = user.username
            session['role'] = user.role # admin, employee, customer
            
            # Check user role details
            if user.role == 'customer':
                customer = Customer.query.filter_by(user_id=user.id).first()
                if not customer:
                    flash('Customer profile not found.', 'danger')
                    return redirect(url_for('login'))
                if customer.status != 'Active':
                    session.clear()
                    flash('Your account has been deactivated. Please contact support.', 'danger')
                    return redirect(url_for('login'))
                session['customer_name'] = customer.name
                session['customer_id'] = customer.id
            elif user.role == 'employee':
                employee = Employee.query.filter_by(user_id=user.id).first()
                if not employee:
                    flash('Employee profile not found.', 'danger')
                    return redirect(url_for('login'))
                if employee.status != 'Active':
                    session.clear()
                    flash('Your employee status is Inactive. Please contact administration.', 'danger')
                    return redirect(url_for('login'))
                session['employee_name'] = employee.name
                session['employee_id'] = employee.id
            else:
                # Set default names for admin
                session['employee_name'] = 'Ajinkya Admin'
                session['employee_id'] = 'ADM01'
            
            flash(f'Welcome back, {username}! Logged in successfully.', 'success')
            if user.role == 'admin':
                return redirect(url_for('admin_dashboard'))
            elif user.role == 'employee':
                return redirect(url_for('employee_teller_desk'))
            else:
                return redirect(url_for('customer_dashboard'))
        else:
            flash('Invalid username or password.', 'danger')
            
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    flash('Public registration is disabled. Please contact the branch to open an account.', 'danger')
    return redirect(url_for('login'))

@app.route('/logout')
def logout():
    session.clear()
    flash('Logged out successfully.', 'success')
    return redirect(url_for('login'))


# --- ADMIN ROUTES ---
@app.route('/admin/dashboard')
@login_required
@roles_allowed('admin', 'employee')
def admin_dashboard():
    # Calculate statistics
    total_customers = Customer.query.count()
    total_accounts = Account.query.count()
    
    total_deposits_q = db.session.query(db.func.sum(Account.balance)).scalar()
    total_deposits = total_deposits_q if total_deposits_q is not None else 0
    
    total_withdraws_q = db.session.query(db.func.sum(Transaction.amount)).filter(Transaction.type == 'Withdrawal').scalar()
    total_withdrawals = total_withdraws_q if total_withdraws_q is not None else 0
    
    total_loans_q = db.session.query(db.func.sum(Loan.amount)).filter(Loan.status == 'Approved').scalar()
    total_loans = total_loans_q if total_loans_q is not None else 0
    
    # Today's transaction count
    today = datetime.utcnow().date()
    today_txns = Transaction.query.filter(db.func.date(Transaction.created_at) == today).count()
    
    # Maker-Checker Pending Counts
    pending_loans_count = Loan.query.filter_by(status='Pending').count()
    pending_cards_count = DebitCard.query.filter_by(status='Pending_Approval').count()
    
    # Recent Customers
    recent_customers = Customer.query.order_by(Customer.id.desc()).limit(5).all()
    
    # Recent Transactions
    recent_txns = Transaction.query.order_by(Transaction.id.desc()).limit(5).all()
    
    return render_template('admin/dashboard.html',
                           total_customers=total_customers,
                           total_accounts=total_accounts,
                           total_deposits=total_deposits,
                           total_withdrawals=total_withdrawals,
                           total_loans=total_loans,
                           today_txns=today_txns,
                           pending_loans_count=pending_loans_count,
                           pending_cards_count=pending_cards_count,
                           recent_customers=recent_customers,
                           recent_txns=recent_txns)

@app.route('/admin/customers')
@login_required
@roles_allowed('admin', 'employee')
def admin_customers():
    search_query = request.args.get('search', '').strip()
    page = request.args.get('page', 1, type=int)
    per_page = 20
    query = Customer.query
    if search_query:
        query = query.filter(
            (Customer.name.ilike(f"%{search_query}%")) | 
            (Customer.customer_id.ilike(f"%{search_query}%")) | 
            (Customer.mobile.ilike(f"%{search_query}%"))
        )
    pagination = query.order_by(Customer.id.asc()).paginate(page=page, per_page=per_page, error_out=False)
    return render_template('admin/customers.html', customers=pagination.items, pagination=pagination, search_query=search_query, total_count=pagination.total)

@app.route('/admin/customers/add', methods=['GET', 'POST'])
@login_required
@roles_allowed('admin', 'employee')
def admin_add_customer():
    branches = Branch.query.all()
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        name = request.form.get('name')
        dob_str = request.form.get('dob')
        gender = request.form.get('gender')
        mobile = request.form.get('mobile')
        email = request.form.get('email')
        aadhaar = request.form.get('aadhaar')
        pan = request.form.get('pan')
        address = request.form.get('address')
        branch_id = request.form.get('branch_id')
        opening_balance = request.form.get('opening_balance', '0.00')
        
        # Validation
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            flash('Username already exists.', 'danger')
            return render_template('admin/add_customer.html', branches=branches)
            
        try:
            # Create User
            new_user = User(
                username=username,
                password_hash=bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
                role='customer'
            )
            db.session.add(new_user)
            db.session.flush()
            
            # Customer ID
            cust_count = Customer.query.count()
            cust_id_str = f"CUST{100 + cust_count + 1}"
            
            new_cust = Customer(
                user_id=new_user.id,
                customer_id=cust_id_str,
                name=name,
                dob=datetime.strptime(dob_str, '%Y-%m-%d').date(),
                gender=gender,
                mobile=mobile,
                email=email,
                aadhaar=aadhaar,
                pan=pan,
                address=address,
                status='Active'
            )
            db.session.add(new_cust)
            db.session.flush()
            
            # Account creation
            acc_count = Account.query.count()
            new_acc_num = f"10000000{7890 + acc_count}"
            bal = Decimal(opening_balance)
            
            new_acc = Account(
                account_number=new_acc_num,
                customer_id=new_cust.id,
                account_type='Savings',
                branch_id=branch_id,
                balance=bal,
                status='Active'
            )
            db.session.add(new_acc)
            db.session.flush()
            
            # Transaction (if opening balance > 0)
            if bal > 0:
                txn_count = Transaction.query.count()
                new_txn = Transaction(
                    transaction_id=f"TXN{10001 + txn_count}",
                    account_id=new_acc.id,
                    type='Deposit',
                    amount=bal,
                    description='Account Opening Balance',
                    payment_mode='Cash'
                )
                db.session.add(new_txn)
                
            db.session.commit()
            flash(f'Customer {name} created successfully with Account: {new_acc_num}!', 'success')
            return redirect(url_for('admin_account_opening_success', account_number=new_acc_num))
        except Exception as e:
            db.session.rollback()
            flash(f'Error creating customer: {e}', 'danger')
            
    return render_template('admin/add_customer.html', branches=branches)

@app.route('/admin/customers/toggle/<int:id>', methods=['POST'])
@login_required
@roles_allowed('admin')
def admin_toggle_customer(id):
    customer = Customer.query.get_or_404(id)
    customer.status = 'Inactive' if customer.status == 'Active' else 'Active'
    # Lock/unlock their accounts as well
    for acc in customer.accounts:
        acc.status = customer.status
    db.session.commit()
    flash(f"Customer {customer.name} status updated to {customer.status}.", "success")
    return redirect(url_for('admin_customers'))

@app.route('/admin/employees')
@login_required
@roles_allowed('admin')
def admin_employees():
    employees = Employee.query.all()
    return render_template('admin/employees.html', employees=employees)

@app.route('/admin/employees/add', methods=['GET', 'POST'])
@login_required
@roles_allowed('admin')
def admin_add_employee():
    branches = Branch.query.all()
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        name = request.form.get('name')
        role = request.form.get('role')
        branch_id = request.form.get('branch_id')
        mobile = request.form.get('mobile')
        email = request.form.get('email')
        
        # Validation
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            flash('Username already exists.', 'danger')
            return render_template('admin/add_employee.html', branches=branches)
            
        try:
            # Create User
            new_user = User(
                username=username,
                password_hash=bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
                role='employee'
            )
            db.session.add(new_user)
            db.session.flush()
            
            # Employee ID
            emp_count = Employee.query.count()
            emp_id_str = f"EMP{emp_count + 1:02d}"
            
            new_emp = Employee(
                user_id=new_user.id,
                employee_id=emp_id_str,
                name=name,
                role=role,
                branch_id=branch_id,
                mobile=mobile,
                email=email,
                status='Active'
            )
            db.session.add(new_emp)
            db.session.commit()
            
            flash(f'Employee {name} ({emp_id_str}) created successfully!', 'success')
            return redirect(url_for('admin_employees'))
        except Exception as e:
            db.session.rollback()
            flash(f'Error creating employee: {e}', 'danger')
            
    return render_template('admin/add_employee.html', branches=branches)

@app.route('/admin/employees/toggle/<int:id>', methods=['POST'])
@login_required
@roles_allowed('admin')
def admin_toggle_employee(id):
    employee = Employee.query.get_or_404(id)
    employee.status = 'Inactive' if employee.status == 'Active' else 'Active'
    db.session.commit()
    flash(f"Employee {employee.name} status updated to {employee.status}.", "success")
    return redirect(url_for('admin_employees'))

@app.route('/admin/branches', methods=['GET', 'POST'])
@login_required
@roles_allowed('admin')
def admin_branches():
    branches = Branch.query.all()
    if request.method == 'POST':
        name = request.form.get('name')
        branch_code = request.form.get('branch_code')
        ifsc_code = request.form.get('ifsc_code')
        address = request.form.get('address')
        
        # Validation
        existing_branch = Branch.query.filter((Branch.branch_code == branch_code) | (Branch.ifsc_code == ifsc_code)).first()
        if existing_branch:
            flash('Branch code or IFSC code already exists.', 'danger')
            return render_template('admin/branches.html', branches=branches)
            
        try:
            new_branch = Branch(branch_code=branch_code, name=name, ifsc_code=ifsc_code, address=address)
            db.session.add(new_branch)
            db.session.commit()
            flash(f"Branch {name} created successfully!", 'success')
            return redirect(url_for('admin_branches'))
        except Exception as e:
            db.session.rollback()
            flash(f"Error creating branch: {e}", 'danger')
            
    return render_template('admin/branches.html', branches=branches)

@app.route('/admin/accounts', methods=['GET'])
@login_required
@roles_allowed('admin', 'employee')
def admin_accounts():
    search_query = request.args.get('search', '').strip()
    page = request.args.get('page', 1, type=int)
    per_page = 20
    query = Account.query
    if search_query:
        query = query.join(Customer).filter(
            (Account.account_number.ilike(f"%{search_query}%")) |
            (Customer.name.ilike(f"%{search_query}%"))
        )
    pagination = query.order_by(Account.id.asc()).paginate(page=page, per_page=per_page, error_out=False)
    return render_template('admin/accounts.html', accounts=pagination.items, pagination=pagination, search_query=search_query, total_count=pagination.total)

@app.route('/admin/loans')
@login_required
@roles_allowed('admin')
def admin_loans():
    loans = Loan.query.order_by(Loan.id.desc()).all()
    return render_template('admin/loans.html', loans=loans)

@app.route('/admin/loans/action/<int:id>/<action>', methods=['POST'])
@login_required
@roles_allowed('admin')
def admin_loan_action(id, action):
    loan = Loan.query.get_or_404(id)
    if action not in ['Approved', 'Rejected']:
        flash('Invalid action.', 'danger')
        return redirect(url_for('admin_loans'))
        
    try:
        user = get_logged_in_user()
        loan.status = action
        loan.approved_by = f"{user.username.upper()} (Credit Risk & Loan Authority)" if user else "Admin Authority"
        loan.approved_at = datetime.utcnow()
        loan.approval_ref = f"AUTH-LN-2026-{random.randint(1000, 9999)}"
        
        # If approved, deposit the loan amount into customer's primary account!
        if action == 'Approved':
            primary_acc = Account.query.filter_by(customer_id=loan.customer_id, status='Active').first()
            if primary_acc:
                primary_acc.balance += loan.amount
                
                txn_count = Transaction.query.count()
                new_txn = Transaction(
                    transaction_id=f"TXN{10001 + txn_count}",
                    account_id=primary_acc.id,
                    type='Deposit',
                    amount=loan.amount,
                    description=f"Approved Loan Disbursement ({loan.loan_id} - Ref: {loan.approval_ref})",
                    payment_mode='Online'
                )
                db.session.add(new_txn)
            else:
                flash(f"Loan approved, but no active account found for Customer to disburse funds.", "warning")
                
        db.session.commit()
        flash(f"Loan {loan.loan_id} has been {action} by Bank Authority (Ref: {loan.approval_ref}).", "success")
    except Exception as e:
        db.session.rollback()
        flash(f"Error acting on loan: {e}", 'danger')
        
    return redirect(url_for('admin_loans'))

@app.route('/admin/reports')
@login_required
@roles_allowed('admin', 'employee')
def admin_reports():
    report_type = request.args.get('report_type', 'Daily Transaction Report')
    from_date_str = request.args.get('from_date')
    to_date_str = request.args.get('to_date')
    
    transactions = []
    accounts = []
    loans = []
    
    # Default date range (current month)
    today = datetime.now()
    if not from_date_str:
        from_date_str = today.replace(day=1).strftime('%Y-%m-%d')
    if not to_date_str:
        to_date_str = today.strftime('%Y-%m-%d')
        
    from_date = datetime.strptime(from_date_str, '%Y-%m-%d')
    # Set to_date to end of the day
    to_date = datetime.strptime(to_date_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
    
    if report_type == 'Daily Transaction Report':
        transactions = Transaction.query.filter(
            Transaction.created_at >= from_date,
            Transaction.created_at <= to_date
        ).order_by(Transaction.created_at.desc()).all()
        
    elif report_type == 'Monthly Account Report':
        accounts = Account.query.filter(
            Account.created_at >= from_date,
            Account.created_at <= to_date
        ).order_by(Account.created_at.desc()).all()
        
    elif report_type == 'Deposit Report':
        transactions = Transaction.query.filter(
            Transaction.type == 'Deposit',
            Transaction.created_at >= from_date,
            Transaction.created_at <= to_date
        ).order_by(Transaction.created_at.desc()).all()
        
    elif report_type == 'Withdrawal Report':
        transactions = Transaction.query.filter(
            Transaction.type == 'Withdrawal',
            Transaction.created_at >= from_date,
            Transaction.created_at <= to_date
        ).order_by(Transaction.created_at.desc()).all()
        
    elif report_type == 'Loan Report':
        loans = Loan.query.filter(
            Loan.created_at >= from_date,
            Loan.created_at <= to_date
        ).order_by(Loan.created_at.desc()).all()
        
    elif report_type == 'Customer Report':
        # List newly registered customers in range
        users = User.query.filter(
            User.role == 'customer',
            User.created_at >= from_date,
            User.created_at <= to_date
        ).all()
        user_ids = [u.id for u in users]
        if user_ids:
            accounts = Account.query.filter(Account.customer_id.in_(
                db.session.query(Customer.id).filter(Customer.user_id.in_(user_ids))
            )).all()
        else:
            accounts = []
            
    return render_template('admin/reports.html',
                           report_type=report_type,
                           from_date=from_date_str,
                           to_date=to_date_str,
                           transactions=transactions,
                           accounts=accounts,
                           loans=loans)


# --- EMPLOYEE ROUTES ---
@app.route('/employee/teller-desk', methods=['GET', 'POST'])
@login_required
@roles_allowed('admin', 'employee')
def employee_teller_desk():
    search_query = (request.args.get('search_acc') or request.form.get('account_number') or '').strip()
    account = None
    recent_txns = []
    
    if search_query:
        # Search by Account Number
        account = Account.query.filter_by(account_number=search_query).first()
        if not account:
            # Search by Mobile Number
            customer = Customer.query.filter_by(mobile=search_query).first()
            if customer and customer.accounts:
                account = customer.accounts[0]
        if not account:
            # Search by Customer Name
            customer = Customer.query.filter(Customer.name.ilike(f"%{search_query}%")).first()
            if customer and customer.accounts:
                account = customer.accounts[0]
                
        if account:
            recent_txns = Transaction.query.filter_by(account_id=account.id).order_by(Transaction.id.desc()).limit(6).all()
        else:
            flash(f"No account found matching '{search_query}'.", "danger")

    if request.method == 'POST' and account:
        action = request.form.get('action')
        amount_str = request.form.get('amount')
        remarks = request.form.get('remarks', 'Counter Transaction')
        payment_mode = request.form.get('payment_mode', 'Cash')
        
        try:
            amount = Decimal(amount_str)
            if amount <= 0:
                raise ValueError("Amount must be greater than zero.")
                
            if action == 'deposit':
                account.balance += amount
                txn_count = Transaction.query.count()
                new_txn = Transaction(
                    transaction_id=f"TXN{10001 + txn_count}",
                    account_id=account.id,
                    type='Deposit',
                    amount=amount,
                    description=remarks or 'Cash Deposit at Fast Teller Desk',
                    payment_mode=payment_mode
                )
                db.session.add(new_txn)
                
                # Simulated SMS Alert
                sms_msg = f"Dear Customer, your Account ending in {account.account_number[-4:]} has been Credited with {format_currency(amount)} on {datetime.now().strftime('%d-%b-%y %I:%M %p')}. Available Balance: {format_currency(account.balance)}. - Ajinkya Bank"
                db.session.add(SMSAlert(customer_id=account.customer.id, mobile=account.customer.mobile, message=sms_msg))
                
                db.session.commit()
                flash(f"Successfully DEPOSITED {format_currency(amount)} into Account {account.account_number}. Available Balance: {format_currency(account.balance)}.", "success")
                return redirect(url_for('employee_teller_desk', search_acc=account.account_number))

            elif action == 'withdraw':
                if account.balance < amount:
                    raise ValueError(f"Insufficient funds. Maximum available: {format_currency(account.balance)}")
                    
                account.balance -= amount
                txn_count = Transaction.query.count()
                new_txn = Transaction(
                    transaction_id=f"TXN{10001 + txn_count}",
                    account_id=account.id,
                    type='Withdrawal',
                    amount=amount,
                    description=remarks or 'Cash Withdrawal at Fast Teller Desk',
                    payment_mode='Cash'
                )
                db.session.add(new_txn)
                
                # Simulated SMS Alert
                sms_msg = f"Dear Customer, your Account ending in {account.account_number[-4:]} has been Debited with {format_currency(amount)} on {datetime.now().strftime('%d-%b-%y %I:%M %p')}. Net Available Balance: {format_currency(account.balance)}. - Ajinkya Bank"
                db.session.add(SMSAlert(customer_id=account.customer.id, mobile=account.customer.mobile, message=sms_msg))
                
                db.session.commit()
                flash(f"Successfully WITHDRAWN {format_currency(amount)} from Account {account.account_number}. Remaining Balance: {format_currency(account.balance)}.", "success")
                return redirect(url_for('employee_teller_desk', search_acc=account.account_number))

            elif action == 'transfer':
                target_acc_num = request.form.get('target_account', '').strip()
                if not target_acc_num:
                    raise ValueError("Target account number is required.")
                if target_acc_num == account.account_number:
                    raise ValueError("Cannot transfer funds to the same account.")
                if account.balance < amount:
                    raise ValueError(f"Insufficient funds for transfer. Available: {format_currency(account.balance)}")
                    
                target_account = Account.query.filter_by(account_number=target_acc_num, status='Active').first()
                if not target_account:
                    raise ValueError(f"Target account {target_acc_num} not found or inactive.")
                    
                # Deduct sender & credit receiver
                account.balance -= amount
                target_account.balance += amount
                
                txn_count = Transaction.query.count()
                t1 = Transaction(
                    transaction_id=f"TXN{10001 + txn_count}",
                    account_id=account.id,
                    type='Transfer',
                    amount=amount,
                    description=f"Counter Transfer to A/C {target_account.account_number} ({remarks})",
                    payment_mode='Online',
                    related_account_number=target_account.account_number
                )
                t2 = Transaction(
                    transaction_id=f"TXN{10002 + txn_count}",
                    account_id=target_account.id,
                    type='Deposit',
                    amount=amount,
                    description=f"Counter Transfer from A/C {account.account_number} ({remarks})",
                    payment_mode='Online',
                    related_account_number=account.account_number
                )
                db.session.add_all([t1, t2])
                db.session.commit()
                flash(f"Successfully TRANSFERRED {format_currency(amount)} to {target_account.customer.name} (A/C: {target_account.account_number}).", "success")
                return redirect(url_for('employee_teller_desk', search_acc=account.account_number))

        except ValueError as ve:
            flash(str(ve), "danger")
        except Exception as e:
            db.session.rollback()
            flash(f"Error executing transaction: {e}", "danger")

    return render_template('employee/teller_desk.html',
                           account=account,
                           search_query=search_query,
                           recent_txns=recent_txns,
                           now_str=datetime.now().strftime('%d-%b-%Y %I:%M %p'))

@app.route('/employee/deposit', methods=['GET', 'POST'])
@login_required
@roles_allowed('admin', 'employee')
def employee_deposit():
    account_number = request.args.get('search_acc') or request.form.get('account_number')
    account = None
    
    if account_number:
        account = Account.query.filter_by(account_number=account_number).first()
        if not account:
            customer = Customer.query.filter_by(mobile=account_number).first()
            if customer and customer.accounts:
                account = customer.accounts[0]
        if not account:
            flash("Account or Mobile number not found.", "danger")
            
    if request.method == 'POST' and account:
        if account.status != 'Active':
            flash("Cannot transact on Inactive Account.", "danger")
            return redirect(url_for('employee_deposit', search_acc=account_number))
            
        amount_str = request.form.get('amount')
        payment_mode = request.form.get('payment_mode')
        remarks = request.form.get('remarks')
        
        try:
            amount = Decimal(amount_str)
            if amount <= 0:
                raise ValueError("Amount must be greater than zero.")
                
            # Perform Deposit
            account.balance += amount
            
            txn_count = Transaction.query.count()
            new_txn = Transaction(
                transaction_id=f"TXN{10001 + txn_count}",
                account_id=account.id,
                type='Deposit',
                amount=amount,
                description=remarks or 'Deposit processed by Employee',
                payment_mode=payment_mode
            )
            db.session.add(new_txn)
            
            # Send simulated SMS alert
            sms_msg = f"Dear Customer, your Account ending in {account.account_number[-4:]} has been Credited with {format_currency(amount)} on {datetime.now().strftime('%d-%b-%y %I:%M %p')}. Net Available Balance: {format_currency(account.balance)}. - Ajinkya Bank"
            alert = SMSAlert(customer_id=account.customer.id, mobile=account.customer.mobile, message=sms_msg)
            db.session.add(alert)
            
            db.session.commit()
            
            flash(f"Successfully deposited {format_currency(amount)} to Account {account.account_number}!", "success")
            return redirect(url_for('employee_deposit', search_acc=account.account_number))
        except ValueError as ve:
            flash(str(ve), "danger")
        except Exception as e:
            db.session.rollback()
            flash(f"Error processing deposit: {e}", "danger")
            
    return render_template('employee/deposit.html', account=account, search_acc=account_number)

@app.route('/employee/withdraw', methods=['GET', 'POST'])
@login_required
@roles_allowed('admin', 'employee')
def employee_withdraw():
    account_number = request.args.get('search_acc') or request.form.get('account_number')
    account = None
    
    if account_number:
        account = Account.query.filter_by(account_number=account_number).first()
        if not account:
            customer = Customer.query.filter_by(mobile=account_number).first()
            if customer and customer.accounts:
                account = customer.accounts[0]
        if not account:
            flash("Account or Mobile number not found.", "danger")
            
    if request.method == 'POST' and account:
        if account.status != 'Active':
            flash("Cannot transact on Inactive Account.", "danger")
            return redirect(url_for('employee_withdraw', search_acc=account_number))
            
        amount_str = request.form.get('amount')
        payment_mode = request.form.get('payment_mode')
        remarks = request.form.get('remarks')
        
        try:
            amount = Decimal(amount_str)
            if amount <= 0:
                raise ValueError("Amount must be greater than zero.")
            if account.balance < amount:
                raise ValueError(f"Insufficient funds. Available: {format_currency(account.balance)}")
                
            # Perform Withdrawal
            account.balance -= amount
            
            txn_count = Transaction.query.count()
            new_txn = Transaction(
                transaction_id=f"TXN{10001 + txn_count}",
                account_id=account.id,
                type='Withdrawal',
                amount=amount,
                description=remarks or 'Withdrawal processed by Employee',
                payment_mode=payment_mode
            )
            db.session.add(new_txn)
            
            # Send simulated SMS alert
            sms_msg = f"Dear Customer, your Account ending in {account.account_number[-4:]} has been Debited with {format_currency(amount)} on {datetime.now().strftime('%d-%b-%y %I:%M %p')}. Net Available Balance: {format_currency(account.balance)}. - Ajinkya Bank"
            alert = SMSAlert(customer_id=account.customer.id, mobile=account.customer.mobile, message=sms_msg)
            db.session.add(alert)
            
            db.session.commit()
            
            flash(f"Successfully withdrew {format_currency(amount)} from Account {account.account_number}!", "success")
            return redirect(url_for('employee_withdraw', search_acc=account.account_number))
        except ValueError as ve:
            flash(str(ve), "danger")
        except Exception as e:
            db.session.rollback()
            flash(f"Error processing withdrawal: {e}", "danger")
            
    return render_template('employee/withdraw.html', account=account, search_acc=account_number)

@app.route('/employee/transfer', methods=['GET', 'POST'])
@login_required
@roles_allowed('admin', 'employee')
def employee_transfer():
    source_acc_num = request.args.get('search_acc') or request.form.get('source_account')
    source_account = None
    
    if source_acc_num:
        source_account = Account.query.filter_by(account_number=source_acc_num).first()
        if not source_account:
            customer = Customer.query.filter_by(mobile=source_acc_num).first()
            if customer and customer.accounts:
                source_account = customer.accounts[0]
        if not source_account:
            flash("Source account or Mobile number not found.", "danger")
            
    if request.method == 'POST' and source_account:
        if source_account.status != 'Active':
            flash("Source account is not active.", "danger")
            return redirect(url_for('employee_transfer', search_acc=source_acc_num))
            
        dest_acc_num = request.form.get('dest_account')
        dest_name = request.form.get('dest_name', '')
        dest_mobile = request.form.get('dest_mobile', '')
        dest_ifsc = request.form.get('dest_ifsc', '')
        amount_str = request.form.get('amount')
        remarks = request.form.get('remarks')
        
        dest_account = Account.query.filter_by(account_number=dest_acc_num).first()
        
        try:
            if not dest_account:
                raise ValueError("Recipient account number not found.")
            if dest_account.status != 'Active':
                raise ValueError("Recipient account is not active.")
                
            # Verify recipient name
            if dest_name.lower().strip() not in dest_account.customer.name.lower():
                raise ValueError("Recipient name does not match the account holder name.")
                
            # Verify branch IFSC code
            if dest_ifsc.upper().strip() != dest_account.branch.ifsc_code.upper():
                raise ValueError("IFSC code does not match the recipient branch's IFSC code.")
                
            if source_account.id == dest_account.id:
                raise ValueError("Source and destination accounts cannot be the same.")
                
            amount = Decimal(amount_str)
            if amount <= 0:
                raise ValueError("Amount must be greater than zero.")
            if source_account.balance < amount:
                raise ValueError(f"Insufficient funds. Available: {format_currency(source_account.balance)}")
                
            # Debit Source
            source_account.balance -= amount
            txn_count = Transaction.query.count()
            src_txn = Transaction(
                transaction_id=f"TXN{10001 + txn_count}",
                account_id=source_account.id,
                type='Withdrawal',
                amount=amount,
                description=remarks or f'Transfer to {dest_account.account_number}',
                payment_mode='Online',
                related_account_number=dest_account.account_number
            )
            db.session.add(src_txn)
            db.session.flush()
            
            # Credit Destination
            dest_account.balance += amount
            dest_txn = Transaction(
                transaction_id=f"TXN{10001 + txn_count + 1}",
                account_id=dest_account.id,
                type='Deposit',
                amount=amount,
                description=remarks or f'Transfer from {source_account.account_number}',
                payment_mode='Online',
                related_account_number=source_account.account_number
            )
            db.session.add(dest_txn)
            
            # SMS to Source Account Holder (Debit Alert)
            src_sms = f"Dear Customer, your Account ending in {source_account.account_number[-4:]} has been Debited with {format_currency(amount)} on {datetime.now().strftime('%d-%b-%y %I:%M %p')} for Transfer to A/c ending in {dest_account.account_number[-4:]}. Net Available Balance: {format_currency(source_account.balance)}. - Ajinkya Bank"
            src_alert = SMSAlert(customer_id=source_account.customer.id, mobile=source_account.customer.mobile, message=src_sms)
            db.session.add(src_alert)
            
            # SMS to Destination Account Holder (Credit Alert)
            dest_sms = f"Dear Customer, your Account ending in {dest_account.account_number[-4:]} has been Credited with {format_currency(amount)} on {datetime.now().strftime('%d-%b-%y %I:%M %p')} from A/c ending in {source_account.account_number[-4:]}. Net Available Balance: {format_currency(dest_account.balance)}. - Ajinkya Bank"
            dest_alert = SMSAlert(customer_id=dest_account.customer.id, mobile=dest_account.customer.mobile, message=dest_sms)
            db.session.add(dest_alert)
            
            db.session.commit()
            flash(f"Successfully transferred {format_currency(amount)} to Account {dest_account.account_number}!", "success")
            return redirect(url_for('employee_transfer', search_acc=source_account.account_number))
        except ValueError as ve:
            flash(str(ve), "danger")
        except Exception as e:
            db.session.rollback()
            flash(f"Error processing transfer: {e}", "danger")
            
    return render_template('employee/transfer.html', source_account=source_account, search_acc=source_acc_num)

@app.route('/employee/account-details')
@login_required
@roles_allowed('admin', 'employee')
def employee_account_details():
    account_number = request.args.get('search_acc')
    account = None
    if account_number:
        account = Account.query.filter_by(account_number=account_number).first()
        if not account:
            flash("Account number not found.", "danger")
            
    return render_template('employee/account_details.html', account=account, search_acc=account_number)


# --- CUSTOMER ROUTES ---
@app.route('/customer/dashboard')
@login_required
@roles_allowed('customer')
def customer_dashboard():
    customer = Customer.query.filter_by(user_id=session['user_id']).first()
    if not customer:
        flash('Customer profile not found.', 'danger')
        return redirect(url_for('logout'))
        
    primary_account = customer.accounts[0] if customer.accounts else None
    
    # Calculate stats
    current_balance = primary_account.balance if primary_account else Decimal('0.00')
    
    # Last Deposit
    last_dep_q = Transaction.query.filter(
        Transaction.account_id == primary_account.id,
        Transaction.type == 'Deposit'
    ).order_by(Transaction.created_at.desc()).first() if primary_account else None
    last_deposit = last_dep_q.amount if last_dep_q else Decimal('0.00')
    
    # Last Withdrawal
    last_with_q = Transaction.query.filter(
        Transaction.account_id == primary_account.id,
        Transaction.type == 'Withdrawal'
    ).order_by(Transaction.created_at.desc()).first() if primary_account else None
    last_withdrawal = last_with_q.amount if last_with_q else Decimal('0.00')
    
    # Total Transactions
    total_txns = Transaction.query.filter(
        Transaction.account_id == primary_account.id
    ).count() if primary_account else 0
    
    # Recent Transactions
    recent_transactions = Transaction.query.filter(
        Transaction.account_id == primary_account.id
    ).order_by(Transaction.created_at.desc()).limit(8).all() if primary_account else []
    
    # Active Debit Card
    card = DebitCard.query.filter_by(account_id=primary_account.id).first() if primary_account else None
    
    # Sample quick transfer targets
    other_accounts = Account.query.filter(Account.id != primary_account.id, Account.status == 'Active').limit(4).all() if primary_account else []

    return render_template('customer/dashboard.html',
                           customer=customer,
                           primary_account=primary_account,
                           current_balance=current_balance,
                           last_deposit=last_deposit,
                           last_withdrawal=last_withdrawal,
                           total_txns=total_txns,
                           recent_transactions=recent_transactions,
                           card=card,
                           other_accounts=other_accounts)

@app.route('/customer/quick-transfer', methods=['GET', 'POST'])
@login_required
@roles_allowed('customer')
def customer_quick_transfer():
    customer = Customer.query.filter_by(user_id=session['user_id']).first()
    if not customer:
        flash('Customer profile not found.', 'danger')
        return redirect(url_for('logout'))
        
    primary_account = customer.accounts[0] if customer.accounts else None
    if not primary_account:
        flash('No active account found for fund transfers.', 'warning')
        return redirect(url_for('customer_dashboard'))

    other_accounts = Account.query.filter(Account.id != primary_account.id, Account.status == 'Active').limit(6).all()

    if request.method == 'POST':
        target_acc_num = request.form.get('target_account', '').strip()
        amount_str = request.form.get('amount', '').strip()
        remarks = request.form.get('remarks', 'NetBanking Quick Transfer')
        
        try:
            amount = Decimal(amount_str)
            if amount <= 0:
                raise ValueError("Amount must be greater than zero.")
            if primary_account.balance < amount:
                raise ValueError(f"Insufficient funds. Available balance: {format_currency(primary_account.balance)}.")
            if target_acc_num == primary_account.account_number:
                raise ValueError("Cannot transfer funds to the same source account.")
                
            target_account = Account.query.filter_by(account_number=target_acc_num, status='Active').first()
            if not target_account:
                # Try finding by mobile
                target_cust = Customer.query.filter_by(mobile=target_acc_num).first()
                if target_cust and target_cust.accounts:
                    target_account = target_cust.accounts[0]
            if not target_account:
                raise ValueError(f"Target beneficiary account '{target_acc_num}' not found or inactive.")
                
            # Execute instant transfer
            primary_account.balance -= amount
            target_account.balance += amount
            
            txn_count = Transaction.query.count()
            t_debit = Transaction(
                transaction_id=f"TXN{10001 + txn_count}",
                account_id=primary_account.id,
                type='Transfer',
                amount=amount,
                description=f"Quick Transfer to {target_account.customer.name} ({remarks})",
                payment_mode='Online',
                related_account_number=target_account.account_number
            )
            t_credit = Transaction(
                transaction_id=f"TXN{10002 + txn_count}",
                account_id=target_account.id,
                type='Deposit',
                amount=amount,
                description=f"Quick Transfer received from {customer.name} ({remarks})",
                payment_mode='Online',
                related_account_number=primary_account.account_number
            )
            db.session.add_all([t_debit, t_credit])
            
            # SMS Alerts
            s1 = SMSAlert(customer_id=customer.id, mobile=customer.mobile, message=f"Debited INR {amount:,.2f} on {datetime.now().strftime('%d-%b-%y %I:%M %p')} for transfer to {target_account.customer.name}. Bal: INR {primary_account.balance:,.2f}. - Ajinkya Bank")
            s2 = SMSAlert(customer_id=target_account.customer.id, mobile=target_account.customer.mobile, message=f"Credited INR {amount:,.2f} on {datetime.now().strftime('%d-%b-%y %I:%M %p')} from {customer.name}. Bal: INR {target_account.balance:,.2f}. - Ajinkya Bank")
            db.session.add_all([s1, s2])
            
            db.session.commit()
            flash(f"🎉 Success! Transferred {format_currency(amount)} to {target_account.customer.name} (A/C: {target_account.account_number}) instantly.", "success")
            return redirect(url_for('customer_dashboard'))
            
        except ValueError as ve:
            flash(str(ve), "danger")
        except Exception as e:
            db.session.rollback()
            flash(f"Transfer failed: {e}", "danger")

    return render_template('customer/quick_transfer.html',
                           primary_account=primary_account,
                           customer=customer,
                           other_accounts=other_accounts)

def get_customer_document(account_number, doc_type):
    upload_dir = os.path.join(app.root_path, 'static', 'uploads', 'documents')
    if os.path.exists(upload_dir):
        for filename in os.listdir(upload_dir):
            if filename.startswith(f"{account_number}_{doc_type}_"):
                return url_for('static', filename=f"uploads/documents/{filename}")
    
    # Fallback to dynamic duplicate/mock document generator
    if doc_type in ['photo_file', 'sign_file']:
        return url_for('render_customer_image_document', account_number=account_number, doc_type=doc_type)
    else:
        return url_for('view_customer_document', account_number=account_number, doc_type=doc_type)

@app.route('/document/view/<account_number>/<doc_type>')
@login_required
def view_customer_document(account_number, doc_type):
    account = Account.query.filter_by(account_number=account_number).first_or_404()
    customer = account.customer
    return render_template('documents/view_document.html', account=account, customer=customer, doc_type=doc_type)

@app.route('/document/image/<account_number>/<doc_type>')
def render_customer_image_document(account_number, doc_type):
    from flask import Response
    account = Account.query.filter_by(account_number=account_number).first()
    customer = account.customer if account else None
    name = customer.name if customer else "Customer"
    initials = "".join([part[0] for part in name.split()[:2]]).upper() if name else "CU"
    
    if doc_type == 'photo_file':
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="160" height="180" viewBox="0 0 160 180">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#1e3a8a"/>
                    <stop offset="100%" stop-color="#2563eb"/>
                </linearGradient>
            </defs>
            <rect width="160" height="180" fill="url(#bg)"/>
            <circle cx="80" cy="70" r="38" fill="rgba(255,255,255,0.2)"/>
            <circle cx="80" cy="70" r="32" fill="rgba(255,255,255,0.3)"/>
            <text x="80" y="80" font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle">{initials}</text>
            <path d="M 20 165 Q 80 120 140 165 Z" fill="rgba(255,255,255,0.25)"/>
            <rect y="152" width="160" height="28" fill="#0f172a"/>
            <text x="80" y="170" font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-size="10" font-weight="bold" fill="#38bdf8" text-anchor="middle" letter-spacing="1">KYC VERIFIED</text>
        </svg>'''
    else: # sign_file
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="220" height="60" viewBox="0 0 220 60">
            <text x="110" y="42" font-family="Brush Script MT, cursive, sans-serif" font-size="28" font-style="italic" font-weight="600" fill="#1e40af" text-anchor="middle" transform="rotate(-3 110 42)">{name}</text>
        </svg>'''
    return Response(svg, mimetype='image/svg+xml')


@app.route('/customer/passbook')
@login_required
@roles_allowed('customer')
def customer_passbook():
    customer = Customer.query.filter_by(user_id=session['user_id']).first()
    primary_account = customer.accounts[0] if customer.accounts else None
    
    transactions = []
    photo_url = None
    sign_url = None
    aadhaar_url = None
    pan_url = None
    
    if primary_account:
        transactions = Transaction.query.filter_by(account_id=primary_account.id).order_by(Transaction.id.desc()).all()
        # Compute running balance
        current_bal = primary_account.balance
        for t in transactions:
            t.running_balance = current_bal
            if t.type == 'Deposit':
                current_bal -= t.amount
            elif t.type == 'Withdrawal':
                current_bal += t.amount
                
        photo_url = get_customer_document(primary_account.account_number, 'photo_file')
        sign_url = get_customer_document(primary_account.account_number, 'sign_file')
        aadhaar_url = get_customer_document(primary_account.account_number, 'aadhaar_file')
        pan_url = get_customer_document(primary_account.account_number, 'pan_file')
        
    return render_template('customer/passbook.html',
                           primary_account=primary_account,
                           transactions=transactions,
                           photo_url=photo_url,
                           sign_url=sign_url,
                           aadhaar_url=aadhaar_url,
                           pan_url=pan_url,
                           customer=customer,
                           is_admin_view=False)

@app.route('/admin/accounts/passbook/<account_number>')
@login_required
@roles_allowed('admin', 'employee')
def admin_view_passbook(account_number):
    account = Account.query.filter_by(account_number=account_number).first_or_404()
    customer = account.customer
    transactions = Transaction.query.filter_by(account_id=account.id).order_by(Transaction.id.desc()).all()
    
    # Compute running balance
    current_bal = account.balance
    for t in transactions:
        t.running_balance = current_bal
        if t.type == 'Deposit':
            current_bal -= t.amount
        elif t.type == 'Withdrawal':
            current_bal += t.amount
            
    photo_url = get_customer_document(account_number, 'photo_file')
    sign_url = get_customer_document(account_number, 'sign_file')
    aadhaar_url = get_customer_document(account_number, 'aadhaar_file')
    pan_url = get_customer_document(account_number, 'pan_file')
    
    return render_template('customer/passbook.html',
                           primary_account=account,
                           transactions=transactions,
                           photo_url=photo_url,
                           sign_url=sign_url,
                           aadhaar_url=aadhaar_url,
                           pan_url=pan_url,
                           customer=customer,
                           is_admin_view=True)

@app.route('/admin/cards/approvals')
@login_required
@roles_allowed('admin', 'employee')
def admin_cards_approval():
    all_cards = DebitCard.query.order_by(DebitCard.id.desc()).all()
    pending_cards = [c for c in all_cards if c.status == 'Pending_Approval']
    active_cards = [c for c in all_cards if c.status in ['Active', 'Frozen', 'Blocked']]
    rejected_cards = [c for c in all_cards if c.status == 'Rejected']
    return render_template('admin/cards_approval.html',
                           pending_cards=pending_cards,
                           active_cards=active_cards,
                           rejected_cards=rejected_cards,
                           total_count=len(all_cards))

@app.route('/admin/cards/action/<int:id>/<action>', methods=['POST'])
@login_required
@roles_allowed('admin', 'employee')
def admin_card_action(id, action):
    card = DebitCard.query.get_or_404(id)
    user = get_logged_in_user()
    
    if action == 'Approve':
        raw_acc = card.account.account_number
        last_4 = raw_acc[-4:]
        mid_4 = raw_acc[-8:-4] if len(raw_acc) >= 8 else "4920"
        card.card_number = f"4532 {mid_4} 8109 {last_4}"
        card.cvv = f"{(int(last_4) * 7 + 123) % 900 + 100}"
        card.status = 'Active'
        card.authorized_by = f"{user.username.upper()} (Operations Authority)" if user else "Branch Authority"
        card.authorized_at = datetime.utcnow()
        card.approval_ref = f"AUTH-VDC-2026-{random.randint(1000, 9999)}"
        card.card_token = f"TKN-{last_4}-{random.randint(100000, 999999)}"
        
        # Log simulated SMS Alert
        sms_msg = f"Dear Customer, your Virtual RuPay Platinum Debit Card for A/C ending in {last_4} has been APPROVED by Ajinkya Bank Authority (Ref: {card.approval_ref}). Active now in your net banking. - Ajinkya Bank"
        alert = SMSAlert(customer_id=card.customer_id, mobile=card.customer.mobile, message=sms_msg)
        db.session.add(alert)
        
        db.session.commit()
        flash(f"Virtual Debit Card for {card.customer.name} (A/C: {raw_acc}) has been AUTHORIZED & ISSUED (Ref: {card.approval_ref}).", "success")
        
    elif action == 'Reject':
        reason = request.form.get('reason', 'Eligibility criteria not met / Incomplete KYC')
        card.status = 'Rejected'
        card.rejection_reason = reason
        card.authorized_by = f"{user.username.upper()} (Operations Authority)" if user else "Branch Authority"
        card.authorized_at = datetime.utcnow()
        db.session.commit()
        flash(f"Virtual Debit Card application for {card.customer.name} has been REJECTED by Bank Authority.", "warning")
        
    return redirect(url_for('admin_cards_approval'))

@app.route('/customer/debit-card', methods=['GET', 'POST'])
@login_required
@roles_allowed('customer')
def customer_debit_card():
    customer = Customer.query.filter_by(user_id=session['user_id']).first()
    if not customer:
        flash('Customer profile not found.', 'danger')
        return redirect(url_for('logout'))
        
    primary_account = customer.accounts[0] if customer.accounts else None
    if not primary_account:
        flash('No active account found to link a Virtual Debit Card.', 'warning')
        return redirect(url_for('customer_dashboard'))
    
    # Query database for existing DebitCard
    card = DebitCard.query.filter_by(account_id=primary_account.id).first()
    
    if request.method == 'POST':
        action = request.form.get('action')
        
        # 1. APPLY FOR VIRTUAL DEBIT CARD (Maker - Customer Request)
        if action in ['apply_card', 'generate_card']:
            if card and card.status in ['Active', 'Pending_Approval', 'Frozen']:
                flash('A Virtual Debit Card request is already on record for this account.', 'info')
                return redirect(url_for('customer_debit_card'))
                
            # KYC Validation Check
            if not customer.aadhaar or not customer.pan:
                flash('KYC Verification Required: Valid Aadhaar and PAN documents must be on file to apply for a Debit Card.', 'danger')
                return redirect(url_for('customer_debit_card'))
                
            pin_input = request.form.get('pin', '1234').strip()
            if not pin_input or len(pin_input) != 4 or not pin_input.isdigit():
                pin_input = '1234'
                
            try:
                atm_limit = Decimal(request.form.get('atm_limit', '50000'))
                pos_limit = Decimal(request.form.get('pos_limit', '100000'))
            except Exception:
                atm_limit = Decimal('50000')
                pos_limit = Decimal('100000')
                
            # Check if instant issuance requested or standard branch authority review
            is_instant = request.form.get('is_instant') == 'true'
            
            raw_acc = primary_account.account_number
            last_4 = raw_acc[-4:]
            mid_4 = raw_acc[-8:-4] if len(raw_acc) >= 8 else "4920"
            card_number_full = f"4532 {mid_4} 8109 {last_4}" if is_instant else None
            cvv = f"{(int(last_4) * 7 + 123) % 900 + 100}" if is_instant else None
            status = 'Active' if is_instant else 'Pending_Approval'
            auth_by = 'CORE_BANKING_ENGINE (Instant Digital Issuance Authority)' if is_instant else None
            auth_ref = f"AUTH-VDC-2026-{random.randint(1000, 9999)}" if is_instant else None
            token = f"TKN-{last_4}-{random.randint(100000, 999999)}" if is_instant else None
            
            if card:
                card.status = status
                card.card_number = card_number_full
                card.cvv = cvv
                card.pin = pin_input
                card.daily_atm_limit = atm_limit
                card.daily_pos_limit = pos_limit
                card.authorized_by = auth_by
                card.authorized_at = datetime.utcnow() if is_instant else None
                card.approval_ref = auth_ref
                card.card_token = token
                card.applied_at = datetime.utcnow()
                new_card = card
            else:
                new_card = DebitCard(
                    card_number=card_number_full,
                    account_id=primary_account.id,
                    customer_id=customer.id,
                    cardholder_name=customer.name.upper(),
                    expiry_month='12',
                    expiry_year='2029',
                    cvv=cvv,
                    pin=pin_input,
                    card_type='RuPay Platinum Virtual',
                    status=status,
                    authorized_by=auth_by,
                    authorized_at=datetime.utcnow() if is_instant else None,
                    approval_ref=auth_ref,
                    card_token=token,
                    daily_atm_limit=atm_limit,
                    daily_pos_limit=pos_limit,
                    is_online_enabled=True,
                    is_contactless_enabled=True,
                    is_international_enabled=False,
                    applied_at=datetime.utcnow()
                )
                db.session.add(new_card)
                
            db.session.commit()
            
            if is_instant:
                flash(f'🎉 Congratulations! Your Virtual RuPay Platinum Debit Card has been authorized by Bank Authority (Ref: {auth_ref}).', 'success')
            else:
                flash('Your Virtual Debit Card application has been submitted to Ajinkya Bank Authority for KYC verification & authorization.', 'info')
                
            return redirect(url_for('customer_debit_card'))

        # 2. INSTANT DEMO AUTHORIZATION OVERRIDE (For testing by user)
        elif action == 'demo_instant_authorize' and card:
            raw_acc = primary_account.account_number
            last_4 = raw_acc[-4:]
            mid_4 = raw_acc[-8:-4] if len(raw_acc) >= 8 else "4920"
            card.card_number = f"4532 {mid_4} 8109 {last_4}"
            card.cvv = f"{(int(last_4) * 7 + 123) % 900 + 100}"
            card.status = 'Active'
            card.authorized_by = 'BRANCH_MANAGER (Operations Authority)'
            card.authorized_at = datetime.utcnow()
            card.approval_ref = f"AUTH-VDC-2026-{random.randint(1000, 9999)}"
            card.card_token = f"TKN-{last_4}-{random.randint(100000, 999999)}"
            db.session.commit()
            flash(f'Virtual Debit Card has been AUTHORIZED by Bank Authority (Ref: {card.approval_ref}). Active now for all transactions!', 'success')
            return redirect(url_for('customer_debit_card'))
            
        # 3. ACTIONS ON EXISTING ACTIVE CARD
        if card and card.status in ['Active', 'Frozen']:
            if action == 'toggle_freeze':
                card.status = 'Frozen' if card.status == 'Active' else 'Active'
                db.session.commit()
                msg = 'Virtual Debit Card has been temporarily frozen.' if card.status == 'Frozen' else 'Virtual Debit Card has been unblocked.'
                flash(msg, 'success')
            elif action == 'update_limits':
                try:
                    card.daily_atm_limit = Decimal(request.form.get('atm_limit', '50000'))
                    card.daily_pos_limit = Decimal(request.form.get('pos_limit', '100000'))
                    db.session.commit()
                    flash(f'Card daily limits updated: ATM ₹{int(card.daily_atm_limit):,}, POS ₹{int(card.daily_pos_limit):,}.', 'success')
                except Exception:
                    flash('Invalid limit values provided.', 'danger')
            elif action == 'set_pin':
                new_pin = request.form.get('new_pin', '').strip()
                if len(new_pin) == 4 and new_pin.isdigit():
                    card.pin = new_pin
                    db.session.commit()
                    flash('ATM Debit Card PIN updated successfully!', 'success')
                else:
                    flash('PIN must be a 4-digit number.', 'warning')
            elif action == 'toggle_channel':
                channel = request.form.get('channel')
                if channel == 'online':
                    card.is_online_enabled = not card.is_online_enabled
                elif channel == 'contactless':
                    card.is_contactless_enabled = not card.is_contactless_enabled
                elif channel == 'international':
                    card.is_international_enabled = not card.is_international_enabled
                db.session.commit()
                flash('Card channel settings updated.', 'success')
                
        return redirect(url_for('customer_debit_card'))

    return render_template('customer/debit_card.html',
                           customer=customer,
                           primary_account=primary_account,
                           card=card,
                           card_number_full=card.card_number if (card and card.status == 'Active') else None,
                           cvv=card.cvv if (card and card.status == 'Active') else None)

@app.route('/admin/accounts/debit-card/<account_number>', methods=['GET', 'POST'])
@login_required
@roles_allowed('admin', 'manager', 'cashier')
def admin_view_debit_card(account_number):
    account = Account.query.filter_by(account_number=account_number).first()
    if not account:
        flash('Account not found.', 'danger')
        return redirect(url_for('admin_accounts'))
    
    customer = account.customer
    card = DebitCard.query.filter_by(account_id=account.id).first()
    user = get_logged_in_user()
    
    # Allow staff/admin to authorize or issue card directly
    if request.method == 'POST':
        action = request.form.get('action')
        if action in ['generate_card', 'authorize_card']:
            raw_acc = account.account_number
            last_4 = raw_acc[-4:]
            mid_4 = raw_acc[-8:-4] if len(raw_acc) >= 8 else "4920"
            card_number_full = f"4532 {mid_4} 8109 {last_4}"
            cvv = f"{(int(last_4) * 7 + 123) % 900 + 100}"
            auth_ref = f"AUTH-VDC-2026-{random.randint(1000, 9999)}"
            auth_by = f"{user.username.upper()} (Operations Authority)" if user else "Branch Authority"
            token = f"TKN-{last_4}-{random.randint(100000, 999999)}"
            
            if card:
                card.card_number = card_number_full
                card.cvv = cvv
                card.status = 'Active'
                card.authorized_by = auth_by
                card.authorized_at = datetime.utcnow()
                card.approval_ref = auth_ref
                card.card_token = token
            else:
                card = DebitCard(
                    card_number=card_number_full,
                    account_id=account.id,
                    customer_id=customer.id,
                    cardholder_name=customer.name.upper(),
                    expiry_month='12',
                    expiry_year='2029',
                    cvv=cvv,
                    pin='1234',
                    card_type='RuPay Platinum Virtual',
                    status='Active',
                    authorized_by=auth_by,
                    authorized_at=datetime.utcnow(),
                    approval_ref=auth_ref,
                    card_token=token,
                    daily_atm_limit=Decimal('50000'),
                    daily_pos_limit=Decimal('100000'),
                    is_online_enabled=True,
                    is_contactless_enabled=True,
                    is_international_enabled=False
                )
                db.session.add(card)
                
            db.session.commit()
            flash(f'Virtual Debit Card AUTHORIZED and issued successfully for Account {account.account_number} (Ref: {auth_ref}).', 'success')
            return redirect(url_for('admin_view_debit_card', account_number=account.account_number))
            
    return render_template('customer/debit_card.html',
                           customer=customer,
                           primary_account=account,
                           card=card,
                           card_number_full=card.card_number if (card and card.status == 'Active') else None,
                           cvv=card.cvv if (card and card.status == 'Active') else None,
                           is_admin_view=True)

@app.route('/customer/loan/apply', methods=['GET', 'POST'])
@login_required
@roles_allowed('customer')
def customer_loan_apply():
    customer = Customer.query.filter_by(user_id=session['user_id']).first()
    
    if request.method == 'POST':
        loan_type = request.form.get('loan_type')
        amount_str = request.form.get('amount')
        duration_months = request.form.get('duration_months')
        
        try:
            amount = Decimal(amount_str)
            if amount <= 0:
                raise ValueError("Loan amount must be positive.")
                
            loan_count = Loan.query.count()
            loan_id_str = f"LOAN{1001 + loan_count}"
            
            new_loan = Loan(
                loan_id=loan_id_str,
                customer_id=customer.id,
                loan_type=loan_type,
                amount=amount,
                duration_months=int(duration_months),
                status='Pending'
            )
            db.session.add(new_loan)
            db.session.commit()
            
            flash(f"Loan application ({loan_id_str}) submitted successfully!", "success")
            return redirect(url_for('customer_dashboard'))
        except ValueError as ve:
            flash(str(ve), "danger")
        except Exception as e:
            db.session.rollback()
            flash(f"Error submitting loan application: {e}", "danger")
            
    # List existing loans
    loans = Loan.query.filter_by(customer_id=customer.id).order_by(Loan.id.desc()).all()
    return render_template('customer/loan_apply.html', customer=customer, loans=loans)

@app.route('/customer/profile', methods=['GET', 'POST'])
@login_required
@roles_allowed('customer')
def customer_profile():
    customer = Customer.query.filter_by(user_id=session['user_id']).first()
    user = User.query.get(session['user_id'])
    
    if request.method == 'POST':
        action = request.form.get('action')
        
        if action == 'update_profile':
            email = request.form.get('email')
            mobile = request.form.get('mobile')
            address = request.form.get('address')
            
            try:
                customer.email = email
                customer.mobile = mobile
                customer.address = address
                db.session.commit()
                flash("Profile updated successfully!", "success")
            except Exception as e:
                db.session.rollback()
                flash(f"Error updating profile: {e}", "danger")
                
        elif action == 'change_password':
            old_pass = request.form.get('old_password')
            new_pass = request.form.get('new_password')
            
            if bcrypt.checkpw(old_pass.encode('utf-8'), user.password_hash.encode('utf-8')):
                user.password_hash = bcrypt.hashpw(new_pass.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                db.session.commit()
                flash("Password updated successfully!", "success")
            else:
                flash("Incorrect current password.", "danger")
                
        return redirect(url_for('customer_profile'))
        
    primary_account = customer.accounts[0] if customer.accounts else None
    return render_template('customer/profile.html', customer=customer, primary_account=primary_account)


# --- API ENDPOINTS FOR CHART DATA ---
@app.route('/api/admin/chart-data')
@login_required
@roles_allowed('admin')
def api_admin_chart_data():
    # 1. Account type distribution
    # SQLite/MySQL compatible counts
    types = db.session.query(Account.account_type, db.func.count(Account.id)).group_by(Account.account_type).all()
    account_types = [t[0] for t in types]
    account_counts = [t[1] for t in types]
    
    # 2. Deposit vs Withdrawal monthly trends (last 6 months)
    # We can group by month. Since SQLite and MySQL date grouping syntax varies, we can fetch all transactions
    # in the last 6 months and group them in python to guarantee dual database compatibility!
    now = datetime.now()
    transactions = Transaction.query.order_by(Transaction.created_at.asc()).all()
    
    monthly_data = {}
    for txn in transactions:
        # Get Month string e.g. "May 2024"
        m_str = txn.created_at.strftime('%b %Y')
        if m_str not in monthly_data:
            monthly_data[m_str] = {'Deposit': 0.0, 'Withdrawal': 0.0}
            
        if txn.type in ['Deposit', 'Withdrawal']:
            monthly_data[m_str][txn.type] += float(txn.amount)
            
    # Take the last 6 months
    sorted_months = list(monthly_data.keys())[-6:]
    deposits = [monthly_data[m]['Deposit'] for m in sorted_months]
    withdrawals = [monthly_data[m]['Withdrawal'] for m in sorted_months]
    
    return jsonify({
        'account_types': account_types,
        'account_counts': account_counts,
        'months': sorted_months,
        'deposits': deposits,
        'withdrawals': withdrawals
    })


# --- NEW SYSTEM ROUTES ---
@app.route('/admin/accounts/success/<account_number>')
@login_required
@roles_allowed('admin', 'employee')
def admin_account_opening_success(account_number):
    account = Account.query.filter_by(account_number=account_number).first_or_404()
    return render_template('admin/account_opening_success.html', account=account)



@app.route('/admin/transactions')
@login_required
@roles_allowed('admin', 'employee')
def transaction_history():
    search_acc = request.args.get('search_acc', '').strip()
    txn_type = request.args.get('txn_type', 'All')
    txn_date = request.args.get('txn_date', '')
    
    query = Transaction.query
    
    if search_acc:
        query = query.join(Account).filter(Account.account_number.like(f"%{search_acc}%"))
    if txn_type != 'All':
        query = query.filter(Transaction.type == txn_type)
    if txn_date:
        try:
            target_date = datetime.strptime(txn_date, '%Y-%m-%d').date()
            query = query.filter(db.func.date(Transaction.created_at) == target_date)
        except ValueError:
            pass
            
    # Pagination
    page = request.args.get('page', 1, type=int)
    pagination = query.order_by(Transaction.id.desc()).paginate(page=page, per_page=10, error_out=False)
    transactions = pagination.items
    
    # Calculate running balance if a specific account is searched
    if search_acc and transactions:
        acc = Account.query.filter_by(account_number=search_acc).first()
        if acc:
            current_bal = acc.balance
            for t in transactions:
                t.running_balance = current_bal
                if t.type == 'Deposit':
                    current_bal -= t.amount
                elif t.type == 'Withdrawal':
                    current_bal += t.amount
    
    return render_template('admin/transactions.html', 
                           transactions=transactions, 
                           pagination=pagination,
                           search_acc=search_acc, 
                           txn_type=txn_type, 
                           txn_date=txn_date)

@app.route('/admin/settings', methods=['GET', 'POST'])
@login_required
@roles_allowed('admin', 'employee')
def settings():
    if request.method == 'POST':
        # Simulating settings update
        flash('System settings updated successfully!', 'success')
        return redirect(url_for('settings'))
    return render_template('admin/settings.html')
@app.route('/admin/balance-inquiry')
@login_required
@roles_allowed('admin', 'employee')
def balance_inquiry():
    search_query = request.args.get('search_acc', '').strip()
    account = None
    if search_query:
        account = Account.query.filter_by(account_number=search_query).first()
        if not account:
            customer = Customer.query.filter_by(mobile=search_query).first()
            if customer and customer.accounts:
                account = customer.accounts[0]
        if not account:
            flash("Account or Mobile number not found.", "danger")
    return render_template('admin/balance_inquiry.html', account=account, search_acc=search_query)


@app.route('/admin/accounts/open', methods=['GET', 'POST'])
@login_required
@roles_allowed('admin', 'employee')
def admin_open_account():
    branches = Branch.query.all()
    if request.method == 'POST':
        first_name = request.form.get('first_name')
        last_name = request.form.get('last_name')
        name = f"{first_name} {last_name}"
        dob_str = request.form.get('dob')
        gender = request.form.get('gender')
        mobile = request.form.get('mobile')
        email = request.form.get('email')
        aadhaar = request.form.get('aadhaar')
        pan = request.form.get('pan')
        address = request.form.get('address')
        
        # Validation checks for unique database constraints
        if Customer.query.filter_by(aadhaar=aadhaar).first():
            flash("Error opening account: Aadhaar Number is already registered to another customer.", "danger")
            return render_template('admin/open_account.html', branches=branches)
            
        if Customer.query.filter_by(pan=pan).first():
            flash("Error opening account: PAN Number is already registered to another customer.", "danger")
            return render_template('admin/open_account.html', branches=branches)
            
        account_type = request.form.get('account_type')
        branch_id = request.form.get('branch_id')
        opening_balance = request.form.get('opening_balance', '0.00')
        
        # Auto generate username and password
        import string
        import random
        base_username = f"{first_name.lower()}_{last_name.lower()}"
        username = base_username
        suffix = 1
        while User.query.filter_by(username=username).first():
            username = f"{base_username}{suffix}"
            suffix += 1
            
        password = "cust" + "".join(random.choices(string.digits, k=4))
        
        try:
            # Create User
            new_user = User(
                username=username,
                password_hash=bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
                role='customer'
            )
            db.session.add(new_user)
            db.session.flush()
            
            # Customer ID
            cust_count = Customer.query.count()
            cust_id_str = f"CUST{100 + cust_count + 1}"
            
            new_cust = Customer(
                user_id=new_user.id,
                customer_id=cust_id_str,
                name=name,
                dob=datetime.strptime(dob_str, '%Y-%m-%d').date(),
                gender=gender,
                mobile=mobile,
                email=email,
                aadhaar=aadhaar,
                pan=pan,
                address=address,
                status='Active'
            )
            db.session.add(new_cust)
            db.session.flush()
            
            # Account creation
            acc_count = Account.query.count()
            new_acc_num = f"10000000{7890 + acc_count}"
            bal = Decimal(opening_balance)
            
            new_acc = Account(
                account_number=new_acc_num,
                customer_id=new_cust.id,
                account_type=account_type,
                branch_id=branch_id,
                balance=bal,
                status='Active'
            )
            db.session.add(new_acc)
            db.session.flush()
            
            # Handle File Uploads (Aadhaar Card, PAN Card, Photo, Signature)
            upload_dir = os.path.join(app.root_path, 'static', 'uploads', 'documents')
            os.makedirs(upload_dir, exist_ok=True)
            for doc_name in ['aadhaar_file', 'pan_file', 'photo_file', 'sign_file']:
                file = request.files.get(doc_name)
                if file and file.filename != '':
                    filename = f"{new_acc_num}_{doc_name}_{file.filename}"
                    file.save(os.path.join(upload_dir, filename))
            
            # Transaction (if opening balance > 0)
            if bal > 0:
                txn_count = Transaction.query.count()
                new_txn = Transaction(
                    transaction_id=f"TXN{10001 + txn_count}",
                    account_id=new_acc.id,
                    type='Deposit',
                    amount=bal,
                    description='Account Opening Balance',
                    payment_mode='Cash'
                )
                db.session.add(new_txn)
                
            db.session.commit()
            flash(f'Account {new_acc_num} opened successfully for {name}! Credentials generated: Username: {username}, Password: {password}', 'success')
            return redirect(url_for('admin_account_opening_success', account_number=new_acc_num))
        except Exception as e:
            db.session.rollback()
            flash(f'Error opening account: {e}', 'danger')
            
    return render_template('admin/open_account.html', branches=branches)


@app.route('/api/sms-alerts')
@login_required
def api_sms_alerts():
    # If customer, return customer's alerts. If employee/admin, return all system alerts!
    if session.get('role') == 'customer':
        customer = Customer.query.filter_by(user_id=session['user_id']).first()
        if not customer:
            return jsonify([])
        alerts = SMSAlert.query.filter_by(customer_id=customer.id).order_by(SMSAlert.created_at.desc()).all()
    else:
        # Show all alerts for verification
        alerts = SMSAlert.query.order_by(SMSAlert.created_at.desc()).all()
        
    return jsonify([{
        'id': a.id,
        'mobile': a.mobile,
        'message': a.message,
        'created_at': a.created_at.strftime('%Y-%m-%d %H:%M:%S')
    } for a in alerts])


if __name__ == '__main__':
    # Determine port from env or default to 5000
    app.run(debug=True, port=5000)
