// OverflightCalculator.js - Separate file for calculating satellite overflight intervals
// This can be used for debugging by logging overflights and intervals to console

function computeNextFreeIntervals(satellites, currentTime) {
    let overflights = [];

    satellites.forEach(sat => {
        const omega = sat.angularSpeed;
        if (omega === 0) return; // Skip if no motion

        const T_ms = (2 * Math.PI / omega) * 1000; // Period in milliseconds
        let phase = sat.angle % (2 * Math.PI);
        if (phase < 0) phase += 2 * Math.PI;
        let delta = (2 * Math.PI - phase) % (2 * Math.PI);
        let t_next_ms = (delta / omega) * 1000;

        // Ensure next is after current time
        if (t_next_ms < 0) t_next_ms += T_ms; // Rare, but handle negative

        let next = new Date(currentTime.getTime() + t_next_ms);

        // Collect next 4 overflights per satellite for sufficient coverage
        for (let k = 0; k < 4; k++) {
            overflights.push(next);
            next = new Date(next.getTime() + T_ms);
        }
    });

    // Sort overflights
    overflights.sort((a, b) => a.getTime() - b.getTime());

    // Remove duplicates (within 1 second tolerance for floating-point issues)
    let uniqueOverflights = [overflights[0]];
    for (let i = 1; i < overflights.length; i++) {
        if (overflights[i].getTime() - uniqueOverflights[uniqueOverflights.length - 1].getTime() > 1000) {
            uniqueOverflights.push(overflights[i]);
        }
    }

    // Take the first 4 unique overflights after current time
    uniqueOverflights = uniqueOverflights.filter(t => t > currentTime).slice(0, 4);

    // If fewer than 4, pad with further ones if needed, but assume enough
    while (uniqueOverflights.length < 4) {
        // This shouldn't happen with 5 sats, but safeguard
        uniqueOverflights.push(new Date(uniqueOverflights[uniqueOverflights.length - 1].getTime() + 3600000)); // +1 hour placeholder
    }

    let intervals = [];
    for (let i = 0; i < 3; i++) {
        const start = uniqueOverflights[i];
        const end = uniqueOverflights[i + 1];
        const duration_ms = end.getTime() - start.getTime();

        const dur_h = Math.floor(duration_ms / 3600000);
        const dur_m = Math.floor((duration_ms % 3600000) / 60000);
        const dur_s = Math.floor((duration_ms % 60000) / 1000);

        intervals.push({
            start: start.toLocaleString(),
            end: end.toLocaleString(),
            duration: `${dur_h.toString().padStart(2, '0')}:${dur_m.toString().padStart(2, '0')}:${dur_s.toString().padStart(2, '0')}`
        });
    }

    // Debug logging
    console.log('Computed overflights:', uniqueOverflights.map(t => t.toISOString()));
    console.log('Next 3 free intervals:', intervals);

    return intervals;
}