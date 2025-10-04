window.satellites = null;
window.animId = null;

function initializeSatelliteSimulation(views, earthImages, C_orbit, U_orbit, V_orbit, user_lat, user_lon) {
    // Define 5 satellites with names
    const satellites = [
        { r: 1 + 120 / 200, angle: 0, color: 'red', isDemo: true, name: 'Starlink-1', angularSpeed: 0.1, speedU: 0.1, speedV: 0, effectiveAngle: Math.atan2(0, 0.1), h: 0.1 * (1 + 120 / 200) ** 2, vr: 0 },
        { r: 1 + 150 / 200, angle: Math.PI / 5, color: 'green', isDemo: true, name: 'ISS', angularSpeed: 0.15, speedU: 0.1, speedV: 0.05, effectiveAngle: Math.atan2(0.05, 0.1), h: 0.15 * (1 + 150 / 200) ** 2, vr: 0 },
        { r: 1 + 180 / 200, angle: 2 * Math.PI / 5, color: 'blue', isDemo: true, name: 'OneWeb-1', angularSpeed: 0.2, speedU: 0.1, speedV: 0.1, effectiveAngle: Math.atan2(0.1, 0.1), h: 0.2 * (1 + 180 / 200) ** 2, vr: 0 },
        { r: 1 + 210 / 200, angle: 3 * Math.PI / 5, color: 'yellow', isDemo: true, name: 'GPS-1', angularSpeed: 0.25, speedU: 0.1, speedV: 0.15, effectiveAngle: Math.atan2(0.15, 0.1), h: 0.25 * (1 + 210 / 200) ** 2, vr: 0 },
        { r: 1 + 240 / 200, angle: 4 * Math.PI / 5, color: 'purple', isDemo: true, name: 'GEO-Sat-1', angularSpeed: 0.3, speedU: 0.1, speedV: 0.2, effectiveAngle: Math.atan2(0.2, 0.1), h: 0.3 * (1 + 240 / 200) ** 2, vr: 0 }
    ];
    window.satellites = satellites;

    function updateTrajectories() {
        views.forEach(view => {
            const offCtx = view.offscreen.getContext('2d');
            offCtx.clearRect(0, 0, view.offscreen.width, view.offscreen.height);

            const earthImg = new Image();
            earthImg.src = earthImages[view.canvas.id];
            offCtx.drawImage(earthImg, 0, 0);

            const { C_orbit, U_orbit, V_orbit, C_proj, U_proj, V_proj, mode } = view.config;
            const centerX = view.canvas.width / 2;
            const centerY = view.canvas.height / 2;
            const earth_radius = view.earth_radius;
            const isAux = view.canvas.id !== 'main';

            window.satellites.forEach(sat => {
                if (sat.r < 1) return;

                // Draw trajectory
                offCtx.strokeStyle = sat.color;
                offCtx.lineWidth = 2;
                offCtx.beginPath();
                let first = true;

                const angle = sat.effectiveAngle;
                const r = sat.r;
                const dir = [
                    Math.cos(angle) * U_orbit[0] + Math.sin(angle) * V_orbit[0],
                    Math.cos(angle) * U_orbit[1] + Math.sin(angle) * V_orbit[1],
                    Math.cos(angle) * U_orbit[2] + Math.sin(angle) * V_orbit[2]
                ];

                for (let phi = 0; phi <= 2 * Math.PI; phi += 0.01) {
                    const cosP = Math.cos(phi);
                    const sinP = Math.sin(phi);
                    const pos = [
                        r * (cosP * C_orbit[0] + sinP * dir[0]),
                        r * (cosP * C_orbit[1] + sinP * dir[1]),
                        r * (cosP * C_orbit[2] + sinP * dir[2])
                    ];
                    const x_proj = pos[0] * U_proj[0] + pos[1] * U_proj[1] + pos[2] * U_proj[2];
                    const y_proj = pos[0] * V_proj[0] + pos[1] * V_proj[1] + pos[2] * V_proj[2];
                    const z_proj = pos[0] * C_proj[0] + pos[1] * C_proj[1] + pos[2] * C_proj[2];

                    const rho2 = x_proj * x_proj + y_proj * y_proj;
                    const px = centerX + earth_radius * x_proj;
                    const py = centerY - earth_radius * y_proj;

                    if (!isAux && z_proj < 0) {
                        first = true;
                        continue;
                    }

                    if (first) {
                        offCtx.moveTo(px, py);
                        first = false;
                    } else {
                        offCtx.lineTo(px, py);
                    }
                }
                offCtx.stroke();
            });

            if (isAux) {
                offCtx.font = '14px Arial';
                offCtx.textAlign = 'left';
                offCtx.fillStyle = '#FFFFFF';
                offCtx.fillText(view.canvas.id === 'second' ? 'Side View (East-West)' : 'Side View (North-South)', 10, 20);

                window.satellites.forEach((sat, i) => {
                    const speedText = mode === 'U' ? sat.speedU.toFixed(3) : mode === 'V' ? sat.speedV.toFixed(3) : sat.angularSpeed.toFixed(3);
                    const label = mode === 'U' ? 'U-comp' : mode === 'V' ? 'V-comp' : 'Net';
                    offCtx.fillStyle = sat.color;
                    offCtx.fillText(`${sat.name}: ${speedText} rad/s`, view.canvas.width - 250, 50 + i * 25);
                });
            }
        });
    }

    let lastTime = performance.now();
    function animate(timestamp) {
        const delta = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        for (let i = window.satellites.length - 1; i >= 0; i--) {
            const sat = window.satellites[i];
            if (sat.r < 1) continue;
            sat.angle += sat.angularSpeed * delta;
        }

        updateTrajectories();

        views.forEach(view => {
            const ctx = view.canvas.getContext('2d');
            const { C_orbit, U_orbit, V_orbit, C_proj, U_proj, V_proj, mode } = view.config;
            const centerX = view.canvas.width / 2;
            const centerY = view.canvas.height / 2;
            const earth_radius = view.earth_radius;

            ctx.clearRect(0, 0, view.canvas.width, view.canvas.height);
            ctx.drawImage(view.offscreen, 0, 0);

            window.satellites.forEach(sat => {
                if (sat.r < 1) return;

                const r = sat.r;
                const cosA = Math.cos(sat.angle);
                const sinA = Math.sin(sat.angle);
                const angle = sat.effectiveAngle;
                const dir = [
                    Math.cos(angle) * U_orbit[0] + Math.sin(angle) * V_orbit[0],
                    Math.cos(angle) * U_orbit[1] + Math.sin(angle) * V_orbit[1],
                    Math.cos(angle) * U_orbit[2] + Math.sin(angle) * V_orbit[2]
                ];

                const pos = [
                    r * (cosA * C_orbit[0] + sinA * dir[0]),
                    r * (cosA * C_orbit[1] + sinA * dir[1]),
                    r * (cosA * C_orbit[2] + sinA * dir[2])
                ];

                const x_proj = pos[0] * U_proj[0] + pos[1] * U_proj[1] + pos[2] * U_proj[2];
                const y_proj = pos[0] * V_proj[0] + pos[1] * V_proj[1] + pos[2] * V_proj[2];
                const z_proj = pos[0] * C_proj[0] + pos[1] * C_proj[1] + pos[2] * C_proj[2];

                if (z_proj >= 0) {
                    const px = centerX + earth_radius * x_proj;
                    const py = centerY - earth_radius * y_proj;
                    ctx.fillStyle = sat.color;
                    ctx.beginPath();
                    ctx.arc(px, py, 5, 0, 2 * Math.PI);
                    ctx.fill();

                    if (view.canvas.id === 'main') {
                        ctx.font = '12px Arial';
                        ctx.fillStyle = 'white';
                        ctx.textAlign = 'center';
                        ctx.fillText(sat.name, px, py - 8);
                    }
                }
            });
        });

        window.animId = requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);

    function updateTimeAndIntervals() {
        const now = new Date();
        document.getElementById('current-time').textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

        if (document.getElementById('user-location').textContent.includes('Lat')) {
            const updatedIntervals = computeNextFreeIntervals(window.satellites, now);
            const intervalsDiv = document.getElementById('intervals');
            intervalsDiv.innerHTML = updatedIntervals.map((int, idx) => `<p>Interval ${idx + 1}: From ${int.start} to ${int.end} (${int.duration})</p>`).join('');
        }
    }

    updateTimeAndIntervals();
    setInterval(updateTimeAndIntervals, 1000);

    const sidePanel = document.querySelector('.side-panel');
    if (!document.getElementById('sat-header')) {
        const satHeader = document.createElement('h3');
        satHeader.id = 'sat-header';
        satHeader.textContent = 'Active Satellites (5 Total)';
        sidePanel.insertBefore(satHeader, document.getElementById('sat-list'));

        const satList = document.getElementById('sat-list');
        satList.innerHTML = '';

        const addButton = document.createElement('button');
        addButton.textContent = 'Add New Imaginary Sat (Default)';
        addButton.onclick = () => {
            const radiusStr = prompt('Enter relative radius (e.g., 1.5):');
            const r = parseFloat(radiusStr);
            const angularStr = prompt('Enter angular speed (rad/s):');
            const angular = parseFloat(angularStr);
            const name = prompt('Enter satellite name:') || `Custom Sat ${window.satellites.length + 1}`;

            if (isNaN(r) || isNaN(angular)) {
                alert('Invalid input.');
                return;
            }

            const colors = ['red', 'green', 'blue', 'yellow', 'purple', 'orange', 'pink'];
            const color = colors[window.satellites.length % colors.length];

            const newSat = {
                r,
                angularSpeed: angular,
                angle: Math.PI / 2,
                color,
                isDemo: false,
                name,
                speedU: 0.1,
                speedV: angular - 0.1,
                effectiveAngle: Math.atan2(angular - 0.1, 0.1),
                h: angular * r ** 2,
                vr: 0
            };

            window.satellites.push(newSat);
            updateTrajectories();
            updateSatelliteList();
        };
        document.getElementById('controls').insertBefore(addButton, document.getElementById('controls').firstChild);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete Custom Satellite';
        deleteButton.onclick = () => {
            const customSats = window.satellites.filter(sat => !sat.isDemo);
            if (customSats.length === 0) {
                alert('No custom satellites to delete.');
                return;
            }
            const satIndex = window.satellites.findIndex(sat => !sat.isDemo);
            if (satIndex > -1) {
                window.satellites.splice(satIndex, 1);
                updateTrajectories();
                updateSatelliteList();
            }
        };
        document.getElementById('controls').appendChild(deleteButton);
    }

    function updateSatelliteList() {
        const listDiv = document.getElementById('sat-list');
        listDiv.innerHTML = '';
        window.satellites.forEach((sat, index) => {
            const p = document.createElement('p');
            p.style.color = sat.color;
            const deleteButton = sat.isDemo ? `<span style="color: #6c757d; font-style: italic;">(Demo)</span>` : `<button onclick="handleDeleteSatellite(${index})">X</button>`;
            p.innerHTML = `${sat.name} ${deleteButton}`;
            listDiv.appendChild(p);
        });
    }

    updateSatelliteList();
    setInterval(updateSatelliteList, 1000);
}

function handleDeleteSatellite(index) {
    window.satellites.splice(index, 1);
    updateSatelliteList();
}