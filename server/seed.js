const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // Path to your User model
const dotenv = require('dotenv');

dotenv.config();

mongoose.connect('mongodb://localhost:27017/balaji-app')
    .then(async () => {
        console.log('MongoDB connected');

        const username = 'admin';
        const password = 'password';
        const role = 'A';

        let user = await User.findOne({ username });
        if (user) {
            console.log('User already exists');
            process.exit();
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            username,
            password: hashedPassword,
            role
        });

        await user.save();
        console.log('Admin user created');
        process.exit();
    })
    .catch(err => {
        console.log(err);
        process.exit(1);
    });
