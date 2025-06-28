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

// Serve static files from ../public
app.use(express.static(path.join(__dirname, '../public')));

// Connect to MongoDB
mongoose
	.connect(MONGODB_URI, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
	})
	.then(() => console.log('Connected to MongoDB Atlas'))
	.catch((err) => {
		console.error('MongoDB connection error:', err);
		process.exit(1);
	});

// Mongoose Schema and Model
const symptomSchema = new mongoose.Schema({
	name: String,
	email: String,
	phone: String,
	countryCode: String,
	gender: String,
	address: String,
	pincode: String,
	commonSymptoms: [String],
	detailedSymptoms: String,
	severity: String,
});

const Symptom = mongoose.model('Symptom', symptomSchema);

// Routes
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, '../public', 'Icon.html'));
});


app.get('/map', (req, res) => {
	res.sendFile(path.join(__dirname, '../public', 'map.html'));
});

// POST symptoms
app.post('/api/symptoms', async (req, res) => {
	try {
		const symptomData = req.body;
		const symptom = new Symptom(symptomData);
		await symptom.save();
		res.status(201).send({ message: 'Symptom data saved successfully!' });
	} catch (error) {
		console.error('Error saving symptoms:', error);
		res.status(500).send({ message: 'Error submitting symptoms' });
	}
});

// HTTPS GET helper
const httpsGetPromise = (url) =>
	new Promise((resolve, reject) => {
		https
			.get(url, (response) => {
				let data = '';
				response.on('data', (chunk) => (data += chunk));
				response.on('end', () => {
					try {
						resolve(JSON.parse(data));
					} catch (e) {
						reject(e);
					}
				});
			})
			.on('error', (error) => reject(error));
	});

// GET locations with lat/lng
app.get('/api/locations', async (req, res) => {
	try {
		const locations = await Symptom.find(
			{},
			'pincode commonSymptoms detailedSymptoms'
		);

		const locationData = await Promise.all(
			locations.map(async (location) => {
				const { pincode, commonSymptoms, detailedSymptoms } = location;

				if (pincode) {
					const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
						pincode
					)}&key=${OPEN_CAGE_API_KEY}&countrycode=in`;

					const data = await httpsGetPromise(url);

					if (data.results && data.results.length > 0) {
						const { lat, lng } = data.results[0].geometry;

						return {
							pincode,
							latitude: lat,
							longitude: lng,
							commonSymptoms,
							detailedSymptoms,
						};
					}
				}
				return null;
			})
		);

		res.json(locationData.filter(Boolean));
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
app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});
