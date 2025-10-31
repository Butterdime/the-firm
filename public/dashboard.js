// RPR CIS SCAN v1 - Analytics Dashboard JavaScript

document.addEventListener('DOMContentLoaded', async () => {
    const loading = document.getElementById('loading');
    const dashboardContent = document.getElementById('dashboard-content');

    try {
        // Fetch all analytics data
        const [summary, timeline, failureReasons, recent] = await Promise.all([
            fetch('/api/analytics/summary').then(r => r.json()),
            fetch('/api/analytics/timeline?days=30').then(r => r.json()),
            fetch('/api/analytics/failure-reasons').then(r => r.json()),
            fetch('/api/analytics/recent?limit=10').then(r => r.json()),
        ]);

        // Display summary statistics
        displaySummaryStats(summary);

        // Display timeline chart
        displayTimelineChart(timeline.timeline);

        // Display status distribution chart
        displayStatusChart(summary);

        // Display failure reasons
        displayFailureReasons(failureReasons.failure_reasons);

        // Display recent verifications
        displayRecentVerifications(recent.recent_verifications);

        // Hide loading, show content
        loading.style.display = 'none';
        dashboardContent.style.display = 'block';

    } catch (error) {
        console.error('Error loading dashboard:', error);
        loading.innerHTML = '<p>Error loading analytics data. Please try again.</p>';
    }
});

function displaySummaryStats(summary) {
    const statsGrid = document.getElementById('stats-grid');
    
    const stats = [
        {
            label: 'Total Verifications',
            value: summary.total_verifications,
            class: '',
        },
        {
            label: 'Approved',
            value: summary.approved_count,
            class: 'success',
            subtitle: `${summary.approval_rate}% of total`,
        },
        {
            label: 'Manual Review',
            value: summary.manual_review_count,
            class: 'warning',
            subtitle: `${summary.manual_review_rate}% of total`,
        },
        {
            label: 'Trilogy Passed',
            value: summary.trilogy_passed_count,
            class: 'success',
        },
    ];

    statsGrid.innerHTML = stats.map(stat => `
        <div class="stat-card ${stat.class}">
            <div class="stat-label">${stat.label}</div>
            <div class="stat-value">${stat.value}</div>
            ${stat.subtitle ? `<div class="stat-change">${stat.subtitle}</div>` : ''}
        </div>
    `).join('');
}

function displayTimelineChart(timeline) {
    const canvas = document.getElementById('timeline-canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = 300;

    if (timeline.length === 0) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Prepare data (reverse to show oldest to newest)
    const data = timeline.slice().reverse();
    const maxValue = Math.max(...data.map(d => d.total_count));
    const barWidth = Math.max(20, (canvas.width - 40) / data.length - 10);
    const chartHeight = canvas.height - 60;

    // Draw bars
    data.forEach((item, index) => {
        const barHeight = (item.total_count / maxValue) * chartHeight;
        const x = 20 + index * (barWidth + 10);
        const y = canvas.height - 40 - barHeight;

        // Approved bars (green)
        const approvedHeight = (item.approved_count / maxValue) * chartHeight;
        ctx.fillStyle = '#10b981';
        ctx.fillRect(x, y + (barHeight - approvedHeight), barWidth, approvedHeight);

        // Manual review bars (yellow)
        const reviewHeight = (item.manual_review_count / maxValue) * chartHeight;
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(x, y, barWidth, reviewHeight);

        // Date label
        ctx.fillStyle = '#6b7280';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        const dateLabel = new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        ctx.fillText(dateLabel, x + barWidth / 2, canvas.height - 20);
    });

    // Legend
    ctx.fillStyle = '#10b981';
    ctx.fillRect(20, 10, 15, 15);
    ctx.fillStyle = '#000';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Approved', 40, 22);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(120, 10, 15, 15);
    ctx.fillStyle = '#000';
    ctx.fillText('Manual Review', 140, 22);
}

function displayStatusChart(summary) {
    const canvas = document.getElementById('status-canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = 300;

    const total = summary.total_verifications;
    
    if (total === 0) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
        return;
    }

    const data = [
        { label: 'Approved', value: summary.approved_count, color: '#10b981' },
        { label: 'Manual Review', value: summary.manual_review_count, color: '#f59e0b' },
        { label: 'Rejected', value: summary.rejected_count, color: '#ef4444' },
    ];

    // Draw pie chart
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2 - 20;
    const radius = Math.min(canvas.width, canvas.height) / 3;
    
    let currentAngle = -Math.PI / 2;

    data.forEach(item => {
        const sliceAngle = (item.value / total) * 2 * Math.PI;
        
        // Draw slice
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = item.color;
        ctx.fill();

        currentAngle += sliceAngle;
    });

    // Draw legend
    let legendY = canvas.height - 60;
    data.forEach((item, index) => {
        const legendX = 20 + (index * 150);
        
        ctx.fillStyle = item.color;
        ctx.fillRect(legendX, legendY, 15, 15);
        
        ctx.fillStyle = '#000';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${item.label}: ${item.value}`, legendX + 20, legendY + 12);
    });
}

function displayFailureReasons(reasons) {
    const container = document.getElementById('failure-reasons-list');
    
    if (reasons.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No failure data available</p>';
        return;
    }

    container.innerHTML = reasons.map(reason => `
        <div class="failure-item">
            <div class="failure-reason">${reason.reason}</div>
            <div class="failure-stats">
                <span class="failure-count">${reason.count} occurrences</span>
                <span class="failure-percentage">${reason.percentage}%</span>
            </div>
        </div>
    `).join('');
}

function displayRecentVerifications(verifications) {
    const tbody = document.getElementById('recent-tbody');
    
    if (verifications.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No verifications yet</td></tr>';
        return;
    }

    tbody.innerHTML = verifications.map(v => `
        <tr>
            <td>${new Date(v.created_at).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })}</td>
            <td>${v.business_name}</td>
            <td>${v.abn}</td>
            <td><span class="status-badge ${v.status}">${v.status.replace('_', ' ')}</span></td>
            <td>${v.trilogy_passed ? '✓ Passed' : '✕ Failed'}</td>
            <td>${v.filename}</td>
        </tr>
    `).join('');
}

