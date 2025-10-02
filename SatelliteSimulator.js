function setupAnimation(canvas, config) {
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const mode = config.mode || 'net';
    const { satellites, C_orbit, U_orbit, V_orbit, C_proj, U_proj, V_proj } = config;
    const earth_radius = canvas.width === 400 ? 200 : 100;
    const isAux = canvas.width === 600;

    // Set effective angle and angularSpeed to net for all views
    satellites.forEach(sat => {
        sat.effectiveAngle = Math.atan2(sat.speedV, sat.speedU);
        sat.angularSpeed = Math.sqrt(sat.speedU ** 2 + sat.speedV ** 2);
    });

    // Create offscreen canvas for static parts
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const offCtx = offscreen.getContext('2d');

    // Copy the rendered Earth to offscreen
    offCtx.drawImage(canvas, 0, 0);

    // Draw fixed trajectories on offscreen
    satellites.forEach(sat => {
        const angle = sat.effectiveAngle;
        const dir = [
            Math.cos(angle) * U_orbit[0] + Math.sin(angle) * V_orbit[0],
            Math.cos(angle) * U_orbit[1] + Math.sin(angle) * V_orbit[1],
            Math.cos(angle) * U_orbit[2] + Math.sin(angle) * V_orbit[2]
        ];
        const r = 1 + (sat.radius / 200);
        offCtx.strokeStyle = sat.color;
        offCtx.lineWidth = 2;
        offCtx.beginPath();
        let first = true;
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
            if (rho2 > 1 || z > Math.sqrt(1 - rho2)) {
                const px = centerX + earth_radius * x;
                const py = centerY + earth_radius * y;
                if (first) {
                    offCtx.moveTo(px, py);
                    first = false;
                } else {
                    offCtx.lineTo(px, py);
                }
            } else {
                first = true;
            }
        }
        offCtx.stroke();
    });

    if (isAux) {
        // Draw descriptions on the right side (in black area) for auxiliary canvases
        offCtx.font = '14px Arial';
        offCtx.textAlign = 'left';
        satellites.forEach((sat, i) => {
            const speedText = mode === 'U' ? sat.speedU.toFixed(2) : mode === 'V' ? sat.speedV.toFixed(2) : sat.angularSpeed.toFixed(2);
            const label = mode === 'U' ? 'U-comp' : mode === 'V' ? 'V-comp' : 'Net';
            offCtx.fillStyle = sat.color;
            offCtx.fillText(`Sat ${i + 1} ${label}: ${speedText} rad/s`, 420, 50 + i * 40);
        });
    }

    // Animation loop
    let lastTime = 0;
    function animate(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const delta = (timestamp - lastTime) / 1000; // seconds
        lastTime = timestamp;

        // Draw static background
        ctx.drawImage(offscreen, 0, 0);

        // Draw 3D satellites
        satellites.forEach(sat => {
            // Update angle
            sat.angle += sat.angularSpeed * delta;

            // Compute dir
            const angle = sat.effectiveAngle;
            const dir = [
                Math.cos(angle) * U_orbit[0] + Math.sin(angle) * V_orbit[0],
                Math.cos(angle) * U_orbit[1] + Math.sin(angle) * V_orbit[1],
                Math.cos(angle) * U_orbit[2] + Math.sin(angle) * V_orbit[2]
            ];

            // Compute 3D position
            const r = 1 + (sat.radius / 200);
            const cosA = Math.cos(sat.angle);
            const sinA = Math.sin(sat.angle);
            const pos = [
                r * (cosA * C_orbit[0] + sinA * dir[0]),
                r * (cosA * C_orbit[1] + sinA * dir[1]),
                r * (cosA * C_orbit[2] + sinA * dir[2])
            ];

            // Check visibility
            const x = pos[0] * U_proj[0] + pos[1] * U_proj[1] + pos[2] * U_proj[2];
            const y = pos[0] * V_proj[0] + pos[1] * V_proj[1] + pos[2] * V_proj[2];
            const z = pos[0] * C_proj[0] + pos[1] * C_proj[1] + pos[2] * C_proj[2];
            const rho2 = x * x + y * y;
            const visible = (rho2 > 1) || (z > Math.sqrt(1 - rho2));

            // Debug: Log position and visibility
            console.log(`Sat ${sat.color} (${mode}): pos=[${pos[0].toFixed(2)}, ${pos[1].toFixed(2)}, ${pos[2].toFixed(2)}], visible=${visible}`);

            // Draw satellite if visible
            if (visible) {
                const px = centerX + earth_radius * x;
                const py = centerY + earth_radius * y;
                ctx.fillStyle = sat.color;
                ctx.beginPath();
                ctx.arc(px, py, 5, 0, 2 * Math.PI);
                ctx.fill();
            }
        });

        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
}