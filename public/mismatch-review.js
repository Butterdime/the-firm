// Mismatch Review Dashboard JavaScript
class MismatchReviewDashboard {
  constructor() {
    this.reports = [];
    this.currentReport = null;
    this.apiBase = '/api/mismatch';

    this.init();
  }

  async init() {
    this.bindEvents();
    await this.loadDashboard();
    await this.loadReports();
  }

  bindEvents() {
    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.loadDashboard();
      this.loadReports();
    });

    // Settings button (placeholder)
    document.getElementById('settings-btn').addEventListener('click', () => {
      alert('Settings panel coming soon!');
    });

    // Filters
    document.getElementById('risk-filter').addEventListener('change', () => this.filterReports());
    document.getElementById('status-filter').addEventListener('change', () => this.filterReports());

    // Modal events
    document.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });

    // Action buttons
    document.getElementById('approve-btn').addEventListener('click', () => this.approveReport());
    document.getElementById('reject-btn').addEventListener('click', () => this.showRejectModal());

    // Reject modal
    document.getElementById('confirm-reject').addEventListener('click', () => this.rejectReport());
    document.getElementById('cancel-reject').addEventListener('click', () => this.closeModal());

    // Close modal on outside click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal();
      });
    });
  }

  async loadDashboard() {
    try {
      const response = await fetch(`${this.apiBase}/dashboard`);
      const data = await response.json();

      if (data.success) {
        this.updateStats(data);
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    }
  }

  async loadReports() {
    try {
      document.getElementById('reports-list').innerHTML = `
        <div class="loading-message">
          <div class="spinner"></div>
          <p>Loading verification reports...</p>
        </div>
      `;

      const response = await fetch(`${this.apiBase}/pending`);
      const data = await response.json();

      if (data.success) {
        this.reports = data.pendingReviews;
        this.renderReports(this.reports);
      } else {
        this.showError('Failed to load reports');
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
      this.showError('Failed to load verification reports');
    }
  }

  updateStats(data) {
    const today = new Date().toISOString().split('T')[0];
    const todayStats = data.dailyStats.find(stat => stat.date === today) || {};

    document.getElementById('pending-count').textContent = data.recentReports.filter(r => r.review_status === 'pending').length;
    document.getElementById('critical-count').textContent = data.recentReports.filter(r => r.risk_level === 'critical_risk').length;
    document.getElementById('today-count').textContent = todayStats.total || 0;
    document.getElementById('approved-count').textContent = data.recentReports.filter(r => r.review_status === 'approved').length;
  }

  renderReports(reports) {
    const container = document.getElementById('reports-list');

    if (reports.length === 0) {
      container.innerHTML = `
        <div class="loading-message">
          <p>No reports require manual review at this time.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = reports.map(report => this.createReportCard(report)).join('');
  }

  createReportCard(report) {
    const riskClass = report.risk_level.replace('_', '-');
    const createdDate = new Date(report.created_at).toLocaleDateString();

    return `
      <div class="report-card" data-session-id="${report.session_id}" onclick="dashboard.showReportDetails('${report.session_id}')">
        <div class="report-header">
          <div class="report-title">Session ${report.session_id.slice(-8)}</div>
          <div class="risk-badge ${riskClass}">${report.risk_level.replace('_', ' ')}</div>
        </div>

        <div class="report-meta">
          <div class="meta-item">
            <div class="meta-label">Risk Score</div>
            <div class="meta-value">${report.risk_score}/100</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Mismatches</div>
            <div class="meta-value">${report.mismatch_count}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Created</div>
            <div class="meta-value">${createdDate}</div>
          </div>
        </div>

        <div class="mismatches-preview">
          ${this.createMismatchTags(report)}
        </div>
      </div>
    `;
  }

  createMismatchTags(report) {
    // This is a simplified preview - in a real implementation,
    // you'd fetch the detailed mismatches
    const severityColors = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low'
    };

    // Mock some mismatch tags based on risk level
    const mockMismatches = [];
    if (report.risk_score > 75) mockMismatches.push({ field: 'Name', severity: 'critical' });
    if (report.risk_score > 50) mockMismatches.push({ field: 'Address', severity: 'high' });
    if (report.risk_score > 25) mockMismatches.push({ field: 'Date', severity: 'medium' });

    return mockMismatches.map(mismatch =>
      `<span class="mismatch-tag ${severityColors[mismatch.severity]}">${mismatch.field}</span>`
    ).join('');
  }

  filterReports() {
    const riskFilter = document.getElementById('risk-filter').value;
    const statusFilter = document.getElementById('status-filter').value;

    let filtered = this.reports;

    if (riskFilter) {
      filtered = filtered.filter(r => r.risk_level === riskFilter);
    }

    if (statusFilter) {
      filtered = filtered.filter(r => r.review_status === statusFilter);
    }

    this.renderReports(filtered);
  }

  async showReportDetails(sessionId) {
    try {
      const response = await fetch(`${this.apiBase}/report/${sessionId}`);
      const data = await response.json();

      if (data.success) {
        this.currentReport = data.report;
        this.renderReportDetails(data.report);
        this.showModal('mismatch-modal');
      }
    } catch (error) {
      console.error('Failed to load report details:', error);
      alert('Failed to load report details');
    }
  }

  renderReportDetails(report) {
    const container = document.getElementById('mismatch-details');

    const statusText = report.review_status === 'pending' ? 'Requires Manual Review' :
                      report.review_status === 'approved' ? 'Approved' : 'Rejected';

    const statusColor = report.review_status === 'approved' ? 'var(--success-color)' :
                       report.review_status === 'rejected' ? 'var(--error-color)' :
                       'var(--warning-color)';

    container.innerHTML = `
      <div class="mismatch-summary">
        <div class="summary-grid">
          <div class="summary-item">
            <div class="summary-label">Session ID</div>
            <div class="summary-value">${report.session_id}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Risk Level</div>
            <div class="summary-value" style="color: ${this.getRiskColor(report.risk_level)}">
              ${report.risk_level.replace('_', ' ').toUpperCase()}
            </div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Risk Score</div>
            <div class="summary-value">${report.risk_score}/100</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Status</div>
            <div class="summary-value" style="color: ${statusColor}">${statusText}</div>
          </div>
        </div>
      </div>

      <div class="mismatches-list">
        <h4 style="margin-bottom: 1rem; color: var(--text-color);">Detailed Mismatches</h4>
        ${report.mismatches.map(mismatch => this.createMismatchItem(mismatch)).join('')}
      </div>
    `;
  }

  createMismatchItem(mismatch) {
    const severityColors = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low'
    };

    return `
      <div class="mismatch-item">
        <div class="mismatch-header">
          <div class="mismatch-field">${mismatch.field_name}</div>
          <div class="mismatch-severity ${mismatch.severity}">${mismatch.severity}</div>
        </div>

        <div class="mismatch-comparison">
          <div class="comparison-item">
            <div class="comparison-label">Document Value</div>
            <div class="comparison-value">${mismatch.extracted_value}</div>
          </div>
          <div class="comparison-item">
            <div class="comparison-label">Registry Value</div>
            <div class="comparison-value">${mismatch.registry_value}</div>
          </div>
        </div>

        <div class="mismatch-recommendation">
          <strong>Recommendation:</strong> ${mismatch.recommendation}
        </div>
      </div>
    `;
  }

  getRiskColor(riskLevel) {
    const colors = {
      clear: 'var(--success-color)',
      low_risk: '#68d391',
      medium_risk: 'var(--warning-color)',
      high_risk: '#ed8936',
      critical_risk: 'var(--critical-color)'
    };
    return colors[riskLevel] || 'var(--text-color)';
  }

  async approveReport() {
    if (!this.currentReport) return;

    try {
      const response = await fetch(`${this.apiBase}/approve/${this.currentReport.session_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewedBy: 'dashboard_user',
          notes: 'Approved via mismatch review dashboard'
        })
      });

      const result = await response.json();

      if (result.success) {
        alert('Verification approved successfully!');
        this.closeModal();
        await this.loadDashboard();
        await this.loadReports();
      } else {
        alert('Failed to approve verification: ' + result.error);
      }
    } catch (error) {
      console.error('Approval failed:', error);
      alert('Failed to approve verification');
    }
  }

  showRejectModal() {
    this.closeModal();
    this.showModal('reject-modal');
  }

  async rejectReport() {
    if (!this.currentReport) return;

    const reason = document.getElementById('reject-reason').value.trim();
    if (!reason) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      const response = await fetch(`${this.apiBase}/reject/${this.currentReport.session_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewedBy: 'dashboard_user',
          reason: reason
        })
      });

      const result = await response.json();

      if (result.success) {
        alert('Verification rejected successfully!');
        this.closeModal();
        await this.loadDashboard();
        await this.loadReports();
      } else {
        alert('Failed to reject verification: ' + result.error);
      }
    } catch (error) {
      console.error('Rejection failed:', error);
      alert('Failed to reject verification');
    }
  }

  showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
  }

  closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.remove('show');
    });
    // Clear reject reason
    document.getElementById('reject-reason').value = '';
  }

  showError(message) {
    document.getElementById('reports-list').innerHTML = `
      <div class="loading-message">
        <p style="color: var(--error-color);">${message}</p>
      </div>
    `;
  }
}

// Global instance
let dashboard;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  dashboard = new MismatchReviewDashboard();
});

// Make showReportDetails globally available for onclick handlers
window.showReportDetails = (sessionId) => {
  dashboard.showReportDetails(sessionId);
};
