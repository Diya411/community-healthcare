document.addEventListener('DOMContentLoaded', function () {
	// Initialize the map centered on India
	const map = L.map('map').setView([20.5937, 78.9629], 5);

	// Add OpenStreetMap tile layer
	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 18,
		attribution: '© OpenStreetMap contributors',
	}).addTo(map);

	// Fetch all locations and symptoms in a single request
	fetch('/api/locations')
		.then((response) => {
			if (!response.ok) throw new Error('Failed to fetch locations');
			return response.json();
		})
		.then((locations) => {
			locations.forEach((location) => {
				const { pincode, latitude, longitude, entries } = location;

				if (!latitude || !longitude) return; // Skip entries without valid coordinates

				// Build popup content for all entries in this pincode
				const popupContent = entries
					.map((entry, i) => {
						const commonSymptomsList =
							Array.isArray(entry.commonSymptoms) && entry.commonSymptoms.length
								? entry.commonSymptoms.join('<br>')
								: 'No common symptoms available';
						const detailedSymptoms =
							entry.detailedSymptoms || 'No detailed symptoms available';
						const severity = entry.severity || 'Not specified';

						return `
							<div style="margin-bottom: 12px; border-bottom: 1px solid #ccc; padding-bottom: 8px;">
								<b>Entry ${i + 1}</b><br>
								<b>Common Symptoms:</b><br>${commonSymptomsList}<br>
								<b>Detailed Symptoms:</b><br>${detailedSymptoms}<br>
								<b>Severity:</b> ${severity}
							</div>
						`;
					})
					.join('');

				// Create marker and bind popup
				const marker = L.marker([latitude, longitude]).addTo(map);
				marker.bindPopup(`<b>Pincode:</b> ${pincode}<br><br>${popupContent}`);
			});
		})
		.catch((err) => {
			console.error('Error fetching location data for map:', err);
		});
});
