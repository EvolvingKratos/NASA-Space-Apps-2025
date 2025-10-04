// SatelliteSimulator.js

window.satellites = null;
window.animId = null;

function initializeSatelliteSimulation(views, earthImages, C_orbit, U_orbit, V_orbit) {
    // Gravitational constant * Earth's mass
    const GM = 0.137;
    const baseSpeed = 0.1;

    // Define 5 satellites with radii and angular speeds for stable circular orbits
    window.satellites = [
        { r: 1 + 120 / 200, angle: 0, color: 'red', isDemo: true },
        { r: 1 + 150 / 200, angle: Math.PI / 5, color: 'green', isDemo: true },
        { r: 1 + 180 / 200, angle: 2 * Math.PI / 5, color: 'blue', isDemo: true },
        { r: 1 + 210 / 200, angle: 3 * Math.PI / 5, color: 'yellow', isDemo: true },
        { r: 1 + 240 / 200, angle: 4 * Math.PI / 5, color: 'purple', isDemo: true }
    ];

    // Set angular speed for stable circular orbit: omega = sqrt(GM / r^3)
    window.satellites.forEach(sat => {
        sat.angularSpeed = Math.sqrt(GM / (sat.r ** 3));
        sat.speedU = baseSpeed;
        sat.speedV = sat.angularSpeed - baseSpeed;
        sat.effectiveAngle = Math.atan2(sat.speedV, sat.speedU);
        sat.h = sat.angularSpeed * sat.r ** 2; // Specific angular momentum
        sat.vr = 0; // Radial velocity is zero for circular orbit
        console.log(`Initialized ${sat.color} satellite: r=${sat.r.toFixed(3)}, angularSpeed=${sat.angularSpeed.toFixed(3)}, speedU=${sat.speedU.toFixed(3)}, speedV=${sat.speedV.toFixed(3)}, effectiveAngle=${sat.effectiveAngle.toFixed(3)}`);
    });

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
                if (sat.r < 1) {
                    console.log(`Satellite ${sat.color} skipped in ${mode} view: r=${sat.r.toFixed(3)} < 1`);
                    return; // Skip if satellite is inside Earth
                }

                // Calculate orbital plane direction using current effectiveAngle
                const angle = sat.effectiveAngle;
                const r = sat.r;
                const dir = [
                    Math.cos(angle) * U_orbit[0] + Math.sin(angle) * V_orbit[0],
                    Math.cos(angle) * U_orbit[1] + Math.sin(angle) * V_orbit[1],
                    Math.cos(angle) * U_orbit[2] + Math.sin(angle) * V_orbit[2]
                ];

                // Draw trajectory
                offCtx.strokeStyle = sat.color;
                offCtx.lineWidth = 2;
                offCtx.beginPath();
                let first = true;
                let visiblePoints = 0;
                for (let phi = 0; phi <= 2 * Math.PI; phi += 0.01) {
                    const cosP = Math.cos(phi);
                    const sinP = Math.sin(phi);
                    const pos = [
                        r * (cosP * C_orbit[0] + sinP * dir[0]),
                        r * (cosP * C_orbit[1] + sinP * dir[1]),
                        r * (cosP * C_orbit[2] + sinP * dir[2])
                    ];
                    const x = pos[0] * U_proj[0] + pos[1] * U_proj[1] + pos[2] * U_proj[2];
                    const y = pos[0] * V_proj[0] + pos[1] * V_proj[1] + pos[2] * V_proj[2];
                    const z = pos[0] * C_proj[0] + pos[1] * C_proj[1] + pos[2] * C_proj[2];
                    const rho2 = x * x + y * y;
                    const sqrt_term = Math.sqrt(1 - rho2);
                    if (rho2 > 1 || z >= (isNaN(sqrt_term) ? 0 : sqrt_term)) {
                        const px = centerX + earth_radius * x;
                        const py = centerY + earth_radius * y;
                        if (first) {
                            offCtx.moveTo(px, py);
                            first = false;
                        } else {
                            offCtx.lineTo(px, py);
                        }
                        visiblePoints++;
                    } else {
                        first = true;
                    }
                }
                offCtx.stroke();
                console.log(`Satellite ${sat.color} trajectory in ${mode} view: r=${r.toFixed(3)}, effectiveAngle=${angle.toFixed(3)}, visiblePoints=${visiblePoints}`);
            });

            if (isAux) {
                offCtx.font = '14px Arial';
                offCtx.textAlign = 'left';
                window.satellites.forEach((sat, i) => {
                    const speedText = mode === 'U' ? sat.speedU.toFixed(2) : mode === 'V' ? sat.speedV.toFixed(2) : sat.angularSpeed.toFixed(2);
                    const label = mode === 'U' ? 'U-comp' : mode === 'V' ? 'V-comp' : 'Net';
                    offCtx.fillStyle = sat.color;
                    offCtx.fillText(`Sat ${i + 1} ${label}: ${speedText} rad/s`, view.canvas.width - 180, 50 + i * 40);
                });
            }
        });
    }

    let lastTime = performance.now();
    function animate(timestamp) {
        const delta = (timestamp - lastTime) / 1000; // Delta time in seconds
        lastTime = timestamp;

        // Update satellites with physics
        for (let i = window.satellites.length - 1; i >= 0; i--) {
            const sat = window.satellites[i];
            if (sat.h === 0) {
                sat.r -= 0.1 * delta; // Fall towards center
                if (sat.r <= 0) {
                    console.log(`Satellite ${sat.color} removed: r=${sat.r.toFixed(3)} <= 0`);
                    window.satellites.splice(i, 1);
                    updateTrajectories();
                    updateSatelliteList();
                    continue;
                }
            } else {
                if (sat.r < 1) {
                    sat.h = 0;
                    sat.vr = 0;
                    sat.r = 1;
                    console.log(`Satellite ${sat.color} crashed: r=${sat.r.toFixed(3)}`);
                    updateTrajectories();
                    updateSatelliteList();
                    continue;
                }
                const accel_r = -GM / (sat.r ** 2) + (sat.h ** 2) / (sat.r ** 3);
                sat.vr += accel_r * delta;
                sat.r += sat.vr * delta;
                sat.angle += (sat.h / (sat.r ** 2)) * delta;
                sat.angularSpeed = sat.h / (sat.r ** 2);
                // Only update effectiveAngle for non-demo satellites
                if (!sat.isDemo) {
                    sat.effectiveAngle = Math.atan2(sat.speedV, sat.speedU);
                }
                console.log(`Satellite ${sat.color} update: r=${sat.r.toFixed(3)}, vr=${sat.vr.toFixed(3)}, accel_r=${accel_r.toFixed(3)}, angle=${sat.angle.toFixed(3)}, angularSpeed=${sat.angularSpeed.toFixed(3)}, effectiveAngle=${sat.effectiveAngle.toFixed(3)}`);
            }
        }

        // Redraw trajectories to reflect updated satellite positions
        updateTrajectories();

        // Render each view
        views.forEach(view => {
            const ctx = view.canvas.getContext('2d');
            const { C_orbit, U_orbit, V_orbit, C_proj, U_proj, V_proj, mode } = view.config;
            const centerX = view.canvas.width / 2;
            const centerY = view.canvas.height / 2;
            const earth_radius = view.earth_radius;

            ctx.clearRect(0, 0, view.canvas.width, view.canvas.height); // Clear main canvas
            ctx.drawImage(view.offscreen, 0, 0); // Draw Earth and trajectories

            window.satellites.forEach(sat => {
                if (sat.r < 1) {
                    console.log(`Satellite ${sat.color} not rendered in ${mode} view: r=${sat.r.toFixed(3)} < 1`);
                    return; // Skip if inside Earth
                }
                const angle = sat.effectiveAngle;
                const dir = [
                    Math.cos(angle) * U_orbit[0] + Math.sin(angle) * V_orbit[0],
                    Math.cos(angle) * U_orbit[1] + Math.sin(angle) * V_orbit[1],
                    Math.cos(angle) * U_orbit[2] + Math.sin(angle) * V_orbit[2]
                ];
                const r = sat.r;
                const cosA = Math.cos(sat.angle);
                const sinA = Math.sin(sat.angle);
                const pos = [
                    r * (cosA * C_orbit[0] + sinA * dir[0]),
                    r * (cosA * C_orbit[1] + sinA * dir[1]),
                    r * (cosA * C_orbit[2] + sinA * dir[2])
                ];
                const x = pos[0] * U_proj[0] + pos[1] * U_proj[1] + pos[2] * U_proj[2];
                const y = pos[0] * V_proj[0] + pos[1] * V_proj[1] + pos[2] * V_proj[2];
                const z = pos[0] * C_proj[0] + pos[1] * C_proj[1] + pos[2] * C_proj[2];
                const rho2 = x * x + y * y;
                const sqrt_term = Math.sqrt(1 - rho2);
                const visible = rho2 > 1 || z >= (isNaN(sqrt_term) ? 0 : sqrt_term);
                console.log(`Sat ${sat.color} (${mode}): pos=[${pos[0].toFixed(2)}, ${pos[1].toFixed(2)}, ${pos[2].toFixed(2)}], x=${x.toFixed(2)}, y=${y.toFixed(2)}, z=${z.toFixed(2)}, rho2=${rho2.toFixed(2)}, sqrt_term=${isNaN(sqrt_term) ? 'NaN' : sqrt_term.toFixed(2)}, visible=${visible}`);
                if (visible) {
                    const px = centerX + earth_radius * x;
                    const py = centerY + earth_radius * y;
                    ctx.fillStyle = sat.color;
                    ctx.beginPath();
                    ctx.arc(px, py, 5, 0, 2 * Math.PI);
                    ctx.fill();
                } else {
                    console.log(`Satellite ${sat.color} not visible in ${mode} view: rho2=${rho2.toFixed(2)}, z=${z.toFixed(2)}`);
                }
            });
        });

        window.animId = requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);

    // Function to update time and intervals
    function updateTimeAndIntervals() {
        const now = new Date();
        document.getElementById('current-time').textContent = now.toLocaleString();
        const updatedIntervals = computeNextFreeIntervals(window.satellites, now);
        const intervalsDiv = document.getElementById('intervals');
        intervalsDiv.innerHTML = updatedIntervals.map((int, idx) => `<p>Interval ${idx + 1}: From ${int.start} to ${int.end} (Duration: ${int.duration})</p>`).join('');
    }

    // Initial update
    updateTimeAndIntervals();

    // Update every second
    setInterval(updateTimeAndIntervals, 1000);

    // Initialize UI elements
    const leftHalf = document.getElementById('left-half');
    if (!document.getElementById('sat-header')) {
        const satHeader = document.createElement('h3');
        satHeader.id = 'sat-header';
        satHeader.textContent = 'Current Satellites';
        leftHalf.appendChild(satHeader);

        const satList = document.createElement('div');
        satList.id = 'sat-list';
        leftHalf.appendChild(satList);

        const addButton = document.createElement('button');
        addButton.textContent = 'Add Satellite';
        addButton.onclick = () => {
            const speedUStr = prompt('Enter speedU (rad/s):');
            let speedU = parseFloat(speedUStr);
            if (isNaN(speedU)) {
                alert('Invalid speedU. Please enter a number.');
                return;
            }
            const speedVStr = prompt('Enter speedV (rad/s):');
            let speedV = parseFloat(speedVStr);
            if (isNaN(speedV)) {
                alert('Invalid speedV. Please enter a number.');
                return;
            }
            const radiusStr = prompt('Enter altitude (km):');
            const altitude = parseFloat(radiusStr);
            if (isNaN(altitude) || altitude < 0) {
                alert('Invalid altitude. Please enter a non-negative number.');
                return;
            }

            let sign = 1;
            let speedU_ = speedU;
            let speedV_ = speedV;
            if (speedU < 0) {
                sign = -1;
                speedU_ = -speedU;
                speedV_ = -speedV;
            }
            const angular = Math.sqrt(speedU_ ** 2 + speedV_ ** 2);
            const effective = Math.atan2(speedV_, speedU_);

            const colors = ['red', 'green', 'blue', 'yellow', 'purple', 'orange', 'pink'];
            const color = colors[window.satellites.length % colors.length];
            const newSat = { r: 1 + altitude / 200, angularSpeed: sign * angular, angle: Math.PI / 2, color, isDemo: false };
            newSat.speedU = speedU_;
            newSat.speedV = speedV_;
            newSat.effectiveAngle = effective;
            newSat.h = newSat.angularSpeed * newSat.r ** 2;
            newSat.vr = 0;
            window.satellites.push(newSat);
            console.log(`Added satellite ${newSat.color}: r=${newSat.r.toFixed(3)}, speedU=${newSat.speedU.toFixed(3)}, speedV=${newSat.speedV.toFixed(3)}, angularSpeed=${newSat.angularSpeed.toFixed(3)}, effectiveAngle=${newSat.effectiveAngle.toFixed(3)}`);
            updateTrajectories();
            updateSatelliteList();
        };
        leftHalf.appendChild(addButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete Satellite';
        deleteButton.onclick = () => {
            const idxStr = prompt('Enter satellite index to delete (1-based):');
            const idx = parseInt(idxStr) - 1;
            if (isNaN(idx) || idx < 0 || idx >= window.satellites.length) {
                alert('Invalid index. Please enter a valid satellite index.');
                return;
            }
            console.log(`Deleted satellite ${window.satellites[idx].color}`);
            window.satellites.splice(idx, 1);
            updateTrajectories();
            updateSatelliteList();
        };
        leftHalf.appendChild(deleteButton);
    }

    function updateSatelliteList() {
        const listDiv = document.getElementById('sat-list');
        listDiv.innerHTML = '';
        window.satellites.forEach((sat, i) => {
            const altitude = ((sat.r - 1) * 200).toFixed(0);
            const p = document.createElement('p');
            p.textContent = `Sat ${i + 1}: Color: ${sat.color}, speedU: ${sat.speedU.toFixed(2)}, speedV: ${sat.speedV.toFixed(2)}, Altitude: ${altitude} km`;
            listDiv.appendChild(p);
        });
    }

    updateSatelliteList();

    // Update satellite list every second to show dynamic altitude
    setInterval(updateSatelliteList, 1000);
}