function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(success, error);
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

function error(err) {
    alert(`Error: ${err.message}`);
}

function success(pos) {
    const user_lat = pos.coords.latitude;
    const user_lon = pos.coords.longitude;

    // Debug: Show coordinates
    alert(`Detected Location: Latitude ${user_lat.toFixed(2)}°, Longitude ${user_lon.toFixed(2)}°`);
    console.log(`User Location: Latitude ${user_lat}, Longitude ${user_lon}`);

    const lat_rad = user_lat * Math.PI / 180;
    const lon_rad = user_lon * Math.PI / 180;
    const clat = Math.cos(lat_rad);
    const slat = Math.sin(lat_rad);
    const clon = Math.cos(lon_rad);
    const slon = Math.sin(lon_rad);

    const C_orbit = [clat * clon, clat * slon, slat];

    let U_orbit = [slon, -clon, 0];
    let V_orbit = [slat * clon, slat * slon, -clat];

    const center1_lat = user_lat;
    const center1_lon = user_lon;

    // Centers for the smaller views (calculated based on U and V vectors)
    const center2_x = U_orbit[0];
    const center2_y = U_orbit[1];
    const center2_z = U_orbit[2];
    const center2_lat = Math.asin(center2_z) * 180 / Math.PI;
    const center2_lon = Math.atan2(center2_y, center2_x) * 180 / Math.PI;

    const center3_x = V_orbit[0];
    const center3_y = V_orbit[1];
    const center3_z = V_orbit[2];
    const center3_lat = Math.asin(center3_z) * 180 / Math.PI;
    const center3_lon = Math.atan2(center3_y, center3_x) * 180 / Math.PI;

    const centers = [
        {lat: center1_lat, lon: center1_lon, canvasId: 'main', mode: 'net'},
        {lat: center2_lat, lon: center2_lon, canvasId: 'second', mode: 'U'},
        {lat: center3_lat, lon: center3_lon, canvasId: 'third', mode: 'V'}
    ];

    // Define 5 satellites with different radii, speeds, starting angles, and colors
    const satellites = [
        { radius: 120, angularSpeed: 0.1, angle: 0, color: 'red', plane: 'U' },
        { radius: 150, angularSpeed: 0.15, angle: Math.PI / 5, color: 'green', plane: 'U' },
        { radius: 180, angularSpeed: 0.2, angle: 2 * Math.PI / 5, color: 'blue', plane: 'V' },
        { radius: 210, angularSpeed: 0.25, angle: 3 * Math.PI / 5, color: 'yellow', plane: 'V' },
        { radius: 240, angularSpeed: 0.3, angle: 4 * Math.PI / 5, color: 'purple', plane: 'U' }
    ];

    // Add speedU and speedV to each satellite based on the demo logic
    const baseSpeed = 0.1;
    satellites.forEach(sat => {
        sat.speedU = baseSpeed;
        sat.speedV = sat.angularSpeed - baseSpeed;
    });

    const textureUrl = '2k_earth_daymap.jpg'; // Ensure this file exists!

    const img = new Image();
    img.src = textureUrl;
    img.onload = () => {
        const temp_canvas = document.createElement('canvas');
        temp_canvas.width = img.width;
        temp_canvas.height = img.height;
        const temp_ctx = temp_canvas.getContext('2d');
        temp_ctx.drawImage(img, 0, 0);
        const tex_data = temp_ctx.getImageData(0, 0, img.width, img.height).data;

        centers.forEach(center => {
            const canvas = document.getElementById(center.canvasId);
            renderEarth(center.lat, center.lon, img.width, img.height, tex_data, canvas, center.canvasId === 'main');

            const local_lat_rad = center.lat * Math.PI / 180;
            const local_lon_rad = center.lon * Math.PI / 180;
            const local_clat = Math.cos(local_lat_rad);
            const local_slat = Math.sin(local_lat_rad);
            const local_clon = Math.cos(local_lon_rad);
            const local_slon = Math.sin(local_lon_rad);
            const C_view = [local_clat * local_clon, local_clat * local_slon, local_slat];
            const U_view = [local_slon, -local_clon, 0];
            const V_view = [local_slat * local_clon, local_slat * local_slon, -local_clat];

            const config = {
                C_orbit: C_orbit,
                U_orbit: U_orbit,
                V_orbit: V_orbit,
                C_proj: C_view,
                U_proj: U_view,
                V_proj: V_view,
                satellites: structuredClone(satellites),
                mode: center.mode
            };
            setupAnimation(canvas, config);
        });

        // Function to update time and intervals
        function updateTimeAndIntervals() {
            const now = new Date();
            document.getElementById('current-time').textContent = now.toLocaleString();
            const updatedIntervals = computeNextFreeIntervals(satellites, now);
            const intervalsDiv = document.getElementById('intervals');
            intervalsDiv.innerHTML = updatedIntervals.map((int, idx) => `<p>Interval ${idx + 1}: From ${int.start} to ${int.end} (Duration: ${int.duration})</p>`).join('');
        }

        // Initial update
        updateTimeAndIntervals();

        // Update every second
        setInterval(updateTimeAndIntervals, 1000);
    };
    img.onerror = () => {
        alert('Failed to load the Earth texture image. Ensure 2k_earth_daymap.jpg is in the same directory as this HTML file and that you are running this on a local server.');
    };
}

function renderEarth(center_lat, center_lon, tex_width, tex_height, tex_data, canvas, isMainCanvas) {
    const ctx = canvas.getContext('2d');
    const canvas_width = canvas.width;
    const canvas_height = canvas.height;
    const imageData = ctx.createImageData(canvas_width, canvas_height);
    const data = imageData.data;

    // Clear canvas with black background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas_width, canvas_height);

    // Determine the size of the Earth to draw on this canvas
    const earth_radius = isMainCanvas ? 300 : 100; // Increased to 300px for main canvas to fill 600px height
    const center_offset_x = isMainCanvas ? (canvas_width - (earth_radius * 2)) / 2 : (canvas_width - (earth_radius * 2)) / 2;
    const center_offset_y = isMainCanvas ? (canvas_height - (earth_radius * 2)) / 2 : (canvas_height - (earth_radius * 2)) / 2;

    const lat_rad = center_lat * Math.PI / 180;
    const lon_rad = center_lon * Math.PI / 180;
    const clat = Math.cos(lat_rad);
    const slat = Math.sin(lat_rad);
    const clon = Math.cos(lon_rad);
    const slon = Math.sin(lon_rad);

    const C = [clat * clon, clat * slon, slat];

    let U = [slon, -clon, 0];
    let V = [slat * clon, slat * slon, -clat];

    for (let j = 0; j < canvas_height; j++) {
        for (let i = 0; i < canvas_width; i++) {
            // Map i, j from pixel space to UV space (-1 to 1) relative to the Earth's drawn size
            let x = (i - center_offset_x) / earth_radius - 1;
            let y = (j - center_offset_y) / earth_radius - 1;
            
            const r2 = x * x + y * y;
            const idx = (j * canvas_width + i) * 4;

            // Draw red dot at center for main canvas (before texture)
            if (isMainCanvas && Math.abs(x) < 0.02 && Math.abs(y) < 0.02 && r2 <= 1) {
                data[idx] = 255;      // Red
                data[idx + 1] = 0;    // Green
                data[idx + 2] = 0;    // Blue
                data[idx + 3] = 255;  // Alpha
                continue;
            }

            if (r2 > 1) {
                // Draw black background (outside the circle)
                data[idx] = 0;
                data[idx + 1] = 0;
                data[idx + 2] = 0;
                data[idx + 3] = 255; // Opaque black background
            } else {
                const z = Math.sqrt(1 - r2);
                const px = U[0] * x + V[0] * y + C[0] * z;
                const py = U[1] * x + V[1] * y + C[1] * z;
                const pz = U[2] * x + V[2] * y + C[2] * z;

                // Texture mapping
                let tex_u = 0.5 - (Math.atan2(py, px) / (2 * Math.PI));
                tex_u += 0.5 - 0.075; 
                
                let tex_v = Math.asin(pz) / Math.PI + 0.5;

                let tx = Math.floor(tex_u * tex_width);
                tx = (tx % tex_width + tex_width) % tex_width; 

                let ty = Math.floor((1 - tex_v) * tex_height); 
                
                if (ty < 0) ty = 0;
                if (ty >= tex_height) ty = tex_height - 1;

                const tidx = (ty * tex_width + tx) * 4;

                data[idx] = tex_data[tidx];
                data[idx + 1] = tex_data[tidx + 1];
                data[idx + 2] = tex_data[tidx + 2];
                data[idx + 3] = 255;
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
}