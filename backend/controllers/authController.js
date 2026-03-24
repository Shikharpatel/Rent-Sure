const bcrypt = require('bcrypt');
const User = require('../models/userModel');
const { generateToken } = require('../middleware/authMiddleware');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'Please include all required fields' });
        }

        // Check if user already exists
        const userExists = await User.findByEmail(email);

        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = await User.create(name, email, hashedPassword, role);

        if (user) {
            res.status(201).json({
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user.user_id),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data format / unable to create' });
        }
    } catch (error) {
        console.error('Error in registerUser:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Please include email and password' });
        }

        // Find the user
        const user = await User.findByEmail(email);

        // Check password
        if (user && (await bcrypt.compare(password, user.password))) {
            res.status(200).json({
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                role: user.role,
                token: generateToken(user.user_id),
            });
        } else {
            res.status(401).json({ message: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Error in loginUser:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
};

// @desc    Get current logged in user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (user) {
            res.status(200).json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Error in getUserProfile:', error);
        res.status(500).json({ message: 'Server error fetching profile' });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getUserProfile,
};
