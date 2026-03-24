const Property = require('../models/propertyModel');
const User = require('../models/userModel');

// @desc    Create a new property listing
// @route   POST /api/properties
// @access  Private (Landlord only)
const createProperty = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== 'landlord') {
            return res.status(403).json({ message: 'Access denied. Landlords only.' });
        }

        const { address, city, rent_amount, estimated_deposit, building_year } = req.body;

        if (!address || !city || !rent_amount || estimated_deposit === undefined) {
            return res.status(400).json({ message: 'Please provide address, city, rent amount, and estimated deposit' });
        }

        const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        const property = await Property.create(req.user.id, address, city, rent_amount, estimated_deposit, building_year, inviteCode);
        res.status(201).json(property);
    } catch (error) {
        console.error('Error in createProperty:', error);
        res.status(500).json({ message: 'Server error creating property' });
    }
};

// @desc    Get all properties owned by the logged-in landlord
// @route   GET /api/properties/mine
// @access  Private (Landlord only)
const getMyProperties = async (req, res) => {
    try {
        const properties = await Property.findByOwnerId(req.user.id);
        res.status(200).json(properties);
    } catch (error) {
        console.error('Error in getMyProperties:', error);
        res.status(500).json({ message: 'Server error fetching properties' });
    }
};

// @desc    Get a property securely using its invite code
// @route   GET /api/properties/invite/:code
// @access  Private (Tenant)
const getPropertyByInviteCode = async (req, res) => {
    try {
        const property = await Property.findByInviteCode(req.params.code);
        if (!property) {
            return res.status(404).json({ message: 'Invalid invite code or property not found' });
        }
        res.status(200).json(property);
    } catch (error) {
        console.error('Error in getPropertyByInviteCode:', error);
        res.status(500).json({ message: 'Server error verifying invite code' });
    }
};

// @desc    Get a single property by ID
// @route   GET /api/properties/:id
// @access  Private
const getPropertyById = async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }
        res.status(200).json(property);
    } catch (error) {
        console.error('Error in getPropertyById:', error);
        res.status(500).json({ message: 'Server error fetching property' });
    }
};

// @desc    Update a property
// @route   PUT /api/properties/:id
// @access  Private (Owner only)
const updateProperty = async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        // Only the owner can update
        if (property.owner_id !== req.user.id) {
            return res.status(403).json({ message: 'Access denied. You are not the owner of this property.' });
        }

        const { address, city, rent_amount, estimated_deposit, building_year } = req.body;
        const updated = await Property.update(
            req.params.id,
            address || property.address,
            city || property.city,
            rent_amount || property.rent_amount,
            estimated_deposit !== undefined ? estimated_deposit : property.estimated_deposit,
            building_year || property.building_year
        );

        res.status(200).json(updated);
    } catch (error) {
        console.error('Error in updateProperty:', error);
        res.status(500).json({ message: 'Server error updating property' });
    }
};

// @desc    Delete a property
// @route   DELETE /api/properties/:id
// @access  Private (Owner only)
const deleteProperty = async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        if (property.owner_id !== req.user.id) {
            return res.status(403).json({ message: 'Access denied. You are not the owner of this property.' });
        }

        await Property.deleteProperty(req.params.id);
        res.status(200).json({ message: 'Property deleted successfully' });
    } catch (error) {
        console.error('Error in deleteProperty:', error);
        res.status(500).json({ message: 'Server error deleting property' });
    }
};

module.exports = {
    createProperty,
    getMyProperties,
    getPropertyByInviteCode,
    getPropertyById,
    updateProperty,
    deleteProperty,
};
