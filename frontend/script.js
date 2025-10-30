// API Base URL
const API_BASE_URL = 'http://localhost:3000/api';

// Load districts when page loads
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('districtSelect')) {
        loadDistricts();
    }
    
    // Check if we're on dashboard page
    if (window.location.pathname.includes('dashboard.html')) {
        loadDashboard();

    }
});

// Load districts from API
async function loadDistricts() {
    try {
        const response = await fetch(`${API_BASE_URL}/districts`);
        const data = await response.json();
        
        if (data.success) {
            const select = document.getElementById('districtSelect');
            
            // Clear existing options except the first one
            select.innerHTML = '<option value="">-- Choose District --</option>';
            
            // Add districts from API
            data.districts.forEach(district => {
                const option = document.createElement('option');
                option.value = district;
                option.textContent = district;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading districts:', error);
        alert('Error loading districts. Make sure backend server is running!');
    }
}

// View Dashboard button click
function viewDashboard() {
    const district = document.getElementById('districtSelect').value;
    
    if (!district) {
        alert('Please select a district first!');
        return;
    }
    
    // Navigate to dashboard with district as URL parameter
    window.location.href = `dashboard.html?district=${encodeURIComponent(district)}`;
}

// Load dashboard data
async function loadDashboard() {
    // Get district from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const district = urlParams.get('district');

    
    if (!district) {
        alert('Please select a district from the home page!');
        window.location.href = 'index.html';
        return;
    }
    
    // Show district name
    document.getElementById('districtName').textContent = district;
    
    try {
        // Fetch district statistics
        let url = `${API_BASE_URL}/stats/${district}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            updateDashboard(data.stats);
            document.getElementById('dashboardError').style.display = 'none';
        } else {
            alert('Error loading district data: ' + data.message);
        }
    }catch (error) {
    console.error('Error loading dashboard:', error);
    // Option 1: Show as inline error (preferable user experience)
    const errorBox = document.getElementById('dashboardError');
    if (errorBox) {
        errorBox.textContent = 'Error: Could not load data from backend. Is the server running?';
        errorBox.style.display = 'block';
    }
    // Optionally, you could setTimeout to retry, or provide a "Retry" button.
}
    loadTrendChart(district);
    loadComparisonChart(district);
}

// Update dashboard with real data
function updateDashboard(stats) {
    // Update KPI cards
    document.getElementById('totalJobCards').textContent = stats.totalJobCards.toLocaleString();
    document.getElementById('activeWorkers').textContent = stats.activeWorkers.toLocaleString();
    document.getElementById('workCompleted').textContent = stats.workCompleted.toLocaleString();
    document.getElementById('persondaysGenerated').textContent = stats.persondaysGenerated.toLocaleString();

    
    // Update chart
    updateChart(stats);
}

// Update chart with real data
function updateChart(stats) {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.myChart) {
        window.myChart.destroy();
    }
    
    // Create new chart with real data
    window.myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Job Cards Issued', 'Active Workers', 'Works Completed'],
            datasets: [{
                label: 'MGNREGA Performance',
                data: [stats.totalJobCards, stats.activeWorkers, stats.workCompleted],
                backgroundColor: [
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(75, 192, 192, 0.5)',
                    'rgba(153, 102, 255, 0.5)'
                ],
                borderColor: [
                    'rgba(54, 162, 235, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.y.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Back to home button
function goBack() {
    window.location.href = 'index.html';
}
async function loadTrendChart(district) {
    try {
        let url = `${API_BASE_URL}/trend/${district}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.success) {
            renderTrendChart(data.trend);
            document.getElementById('dashboardError').style.display = 'none';
        }
    } catch (error) {
        console.error("Error loading trend chart:", error);
    }
}

function renderTrendChart(trendData) {
    const labels = trendData.map(item => item.label);
    const jobCards = trendData.map(item => item.jobCards);

    // Destroy existing chart instance if it exists
    if (window.trendChartInstance) {
        window.trendChartInstance.destroy();
    }

    window.trendChartInstance = new Chart(document.getElementById('trendChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Job Cards Issued (Last 6 Months)',
                data: jobCards,
                borderColor: 'rgb(54, 162, 235)',
                tension: 0.2,
                fill: false
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}


async function loadComparisonChart(district) {
    try {
        let url = `${API_BASE_URL}/compare/${district}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.success) 
            renderComparisonChart(data);
            document.getElementById('dashboardError').style.display = 'none';
    } catch (error) {
        console.error("Error loading comparison chart:", error);
    }
}

function renderComparisonChart(data) {
    // Destroy previous chart if needed
    if (window.comparisonChartInstance) window.comparisonChartInstance.destroy();
    window.comparisonChartInstance = new Chart(document.getElementById('comparisonChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: [
                data.district.name,
                'State Avg (' + data.state.month + ' ' + data.state.year + ')'
            ],
            datasets: [{
                label: 'Job Cards Issued',
                data: [data.district.value, data.state.average],
                backgroundColor: [
                    'rgba(54, 162, 235, 0.6)',
                    'rgba(255, 99, 132, 0.6)' 
                ]
            }]
        }
    });
}
