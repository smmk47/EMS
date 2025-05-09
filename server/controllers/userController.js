// User controller for business logic
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models/user');
const { Role } = require('../models/role');
const redisClient = require('../db/redis');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const TOKEN_EXPIRY = '1h';

const signup = async (req, res) => {
  try {
    const { username, password, role: roleName, name, email } = req.body;
    if (!username || !password || !roleName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get role ID from role name
    const role = await Role.query().findOne({ name: roleName });
    if (!role) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.query()
      .insertGraph({
        username,
        password: hashedPassword,
        role_id: role.id,
        name,
        email
      })
      .withGraphFetched('role');

    res.json({
      id: user.id,
      username: user.username,
      role: user.role.name,
      name: user.name,
      email: user.email
    });
  } catch (error) {
    if (error.code === '23505') {
      res.status(400).json({ error: 'Username already exists' });
    } else {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.query()
      .findOne({ username })
      .withGraphFetched('role');
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        role: user.role.name 
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    // Store token in Redis with expiry
    await redisClient.set(`token_${user.id}`, token, {
      EX: 3600 // 1 hour in seconds
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role.name,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Add logout functionality
const logout = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'No token provided' });

    // Add token to blacklist in Redis
    await redisClient.set(`bl_${token}`, 'true', {
      EX: 3600 // Keep blacklisted token for 1 hour
    });

    // Remove user's active token
    if (req.user && req.user.id) {
      await redisClient.del(`token_${req.user.id}`);
    }

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.query()
      .findById(req.user.id)
      .withGraphFetched('role')
      .select('id', 'username', 'name', 'email');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      ...user,
      role: user.role.name
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getEmployees = async (req, res) => {
  try {
    if (req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const employeeRole = await Role.query().findOne({ name: 'employee' });
    
    if (!employeeRole) {
      return res.status(500).json({ error: 'Employee role not found' });
    }

    const employees = await User.query()
      .where('role_id', employeeRole.id)
      .withGraphFetched('role')
      .select('users.id', 'users.username', 'users.name', 'users.email');
    
    res.json(employees.map(emp => ({
      id: emp.id,
      username: emp.username,
      name: emp.name,
      email: emp.email,
      role: emp.role.name
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateMe = async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.query()
      .patchAndFetchById(req.user.id, { name, email })
      .select('id', 'username', 'role', 'name', 'email');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;
    const updaterId = req.user.id;
    const updaterRole = req.user.role;

    // If no ID is provided, user is updating their own profile
    const targetId = id || updaterId;

    // Check if target user exists
    const targetUser = await User.query()
      .findById(targetId)
      .withGraphFetched('role');

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Authorization check
    if (targetId !== updaterId) { // Updating someone else's profile
      if (updaterRole !== 'manager') {
        return res.status(403).json({ error: 'Not authorized to update other users' });
      }
      
      if (targetUser.role.name === 'manager') {
        return res.status(403).json({ error: 'Cannot modify another manager\'s profile' });
      }
    }

    // Perform update
    const updatedUser = await User.query()
      .patchAndFetchById(targetId, { name, email })
      .withGraphFetched('role');

    res.json({
      id: updatedUser.id,
      username: updatedUser.username,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role.name
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    if (req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const employeeId = parseInt(req.params.id);
    const employeeRole = await Role.query().findOne({ name: 'employee' });
    
    const employee = await User.query()
      .findOne({
        'users.id': employeeId,
        'role_id': employeeRole.id
      });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    await User.query().deleteById(employeeId);
    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  signup,
  login,
  logout,
  getMe,
  updateUser,
  getEmployees,
  deleteEmployee
};
