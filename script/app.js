require('dotenv').config();
const https = require('https');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Load environment variables
const OPEN_CAGE_API_KEY = process.env.OPEN_CAGE_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;

if (!OPEN_CAGE_API_KEY || !MONGODB_URI) {
	console.error(
		'ERROR: Missing OPEN_CAGE_API_KEY or MONGODB_URI in environment variables.'
	);
	process.exit(1);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTML Page Routes (Defined BEFORE static files)
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, '../public', 'Icon.html'));
});

app.get('/home', (req, res) => {
	res.sendFile(path.join(__dirname, '../public', 'home.html'));
});

app.get('/form', (req, res) => {
	res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.get('/map', (req, res) => {
	res.sendFile(path.join(__dirname, '../public', 'map.html'));
});

// Serve static assets without auto-serving index.html at root
app.use(express.static(path.join(__dirname, '../public'), { index: false }));

// MongoDB Connection
mongoose
	.connect(MONGODB_URI)
	.then(() => console.log('Connected to MongoDB Atlas'))
	.catch((err) => {
		console.error('MongoDB connection error:', err);
		process.exit(1);
	});

// Mongoose Schema & Model
const symptomSchema = new mongoose.Schema({
	name: String,
	email: String,
	phone: String,
	countryCode: String,
	gender: String,
	address: String,
	pincode: String,
	latitude: Number,
	longitude: Number,
	commonSymptoms: [String],
	detailedSymptoms: String,
	severity: String,
	createdAt: { type: Date, default: Date.now }
});

const Symptom = mongoose.model('Symptom', symptomSchema);

// Helper function to geocode pincodes via OpenCage API
const geocodePincode = (pincode) => {
	return new Promise((resolve) => {
		const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
			pincode
		)}&key=${OPEN_CAGE_API_KEY}&countrycode=in`;

		https
			.get(url, (response) => {
				let data = '';
				response.on('data', (chunk) => (data += chunk));
				response.on('end', () => {
					try {
						const parsed = JSON.parse(data);
						if (parsed.results && parsed.results.length > 0) {
							const { lat, lng } = parsed.results[0].geometry;
							resolve({ latitude: lat, longitude: lng });
						} else {
							resolve(null);
						}
					} catch {
						resolve(null);
					}
				});
			})
			.on('error', () => resolve(null));
	});
};

// POST endpoint: Saves symptoms AND geocodes pincode once at creation
app.post('/api/symptoms', async (req, res) => {
	try {
		const symptomData = req.body;

		if (symptomData.pincode) {
			const coords = await geocodePincode(symptomData.pincode);
			if (coords) {
				symptomData.latitude = coords.latitude;
				symptomData.longitude = coords.longitude;
			}
		}

		const symptom = new Symptom(symptomData);
		await symptom.save();
		res.status(201).send({ message: 'Symptom data saved successfully!' });
	} catch (error) {
		console.error('Error saving symptoms:', error);
		res.status(500).send({ message: 'Error submitting symptoms' });
	}
});

// GET endpoint: Returns grouped location and symptom data
app.get('/api/locations', async (req, res) => {
	try {
		const locations = await Symptom.find(
			{ latitude: { $ne: null }, longitude: { $ne: null } },
			'pincode latitude longitude commonSymptoms detailedSymptoms severity'
		);

		const groupedLocations = locations.reduce((acc, curr) => {
			if (!acc[curr.pincode]) {
				acc[curr.pincode] = {
					pincode: curr.pincode,
					latitude: curr.latitude,
					longitude: curr.longitude,
					entries: [],
				};
			}
			acc[curr.pincode].entries.push({
				commonSymptoms: curr.commonSymptoms,
				detailedSymptoms: curr.detailedSymptoms,
				severity: curr.severity,
			});
			return acc;
		}, {});

		res.json(Object.values(groupedLocations));
	} catch (error) {
		console.error('Error fetching location data:', error);
		res.status(500).send({ message: 'Error fetching location data' });
	}
});

// GET symptoms by pincode
app.get('/api/symptoms/:pincode', async (req, res) => {
	try {
		const { pincode } = req.params;
		const symptomData = await Symptom.find({ pincode });

		if (!symptomData || symptomData.length === 0) {
			return res
				.status(404)
				.json({ message: 'No symptom data found for this pincode' });
		}

		res.json(
			symptomData.map((item) => ({
				commonSymptoms: item.commonSymptoms,
				detailedSymptoms: item.detailedSymptoms,
				severity: item.severity,
			}))
		);
	} catch (error) {
		console.error('Error fetching symptom data:', error);
		res.status(500).send({ message: 'Error fetching symptom data' });
	}
});

// Start server
app.listen(port, '0.0.0.0', () => {
	console.log(`Server running on port ${port}`);
});
