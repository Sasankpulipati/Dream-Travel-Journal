// --- Route Guard ---
(function checkAuth() {
  const user = localStorage.getItem('user');
  const path = window.location.pathname;
  const isAuthPage = path.includes('login.html') || path.includes('register.html');

  // If not logged in and not on auth page -> Redirect to Login
  if (!user && !isAuthPage) {
    window.location.href = 'login.html';
  }

  // If logged in and on auth page -> Redirect to Home
  if (user && isAuthPage) {
    window.location.href = 'index.html';
  }
})();

// --- API Service ---
const API_URL = 'http://localhost:3000/api';

let appData = {
  timeline: [],
  scrapbook: [],
  bucketList: []
};

// Fetch initial data
async function loadData() {
  try {
    const res = await fetch(`${API_URL}/data`);
    if (!res.ok) throw new Error('Failed to fetch data');
    appData = await res.json();
    renderAll();
  } catch (err) {
    console.error(err);
    alert('Error connecting to server. Please run "node server.js" in your terminal.');
  }
}

function renderAll() {
  renderTimeline();
  renderScrapbook();
  renderBucketList();
  renderStats();
  animateTimeline();
  initMap();
}

function renderStats() {
  const memEl = document.getElementById('stat-memories');
  const placeEl = document.getElementById('stat-places');
  const goalEl = document.getElementById('stat-goals');

  if (memEl && appData.timeline) memEl.innerText = appData.timeline.length;
  if (placeEl && appData.scrapbook) placeEl.innerText = appData.scrapbook.length;
  if (goalEl && appData.bucketList) goalEl.innerText = appData.bucketList.length;
}

// Global Map Instance
let map;
let markerLayerGroup; // Layer group to easily clear markers

function initMap() {
  const mapContainer = document.getElementById('map');
  if (!mapContainer || typeof L === 'undefined') return;

  // Check if map is already initialized
  if (mapContainer._leaflet_id) return;

  // 1. Define Layer Groups
  const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  });

  const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  });

  // 2. Initialize Map
  map = L.map('map', {
    center: [20, 0],
    zoom: 2,
    layers: [streets]
  });

  // 3. Add Layer Control
  const baseMaps = {
    "Streets": streets,
    "Satellite": satellite
  };

  L.control.layers(baseMaps).addTo(map);

  // Initialize Layer Group for Markers
  markerLayerGroup = L.layerGroup().addTo(map);

  // 4. Initial Render of Markers
  renderMapMarkers();

  // 5. Dynamic Map Click to Set Location
  let tempMarker;
  map.on('click', function (e) {
    const { lat, lng } = e.latlng;

    const latInput = document.querySelector('input[name="lat"]');
    const lngInput = document.querySelector('input[name="lng"]');

    if (latInput && lngInput) {
      latInput.value = lat.toFixed(6);
      lngInput.value = lng.toFixed(6);

      if (tempMarker) map.removeLayer(tempMarker);
      tempMarker = L.marker([lat, lng], { opacity: 0.7 }).addTo(map);
      tempMarker.bindPopup("Selected Location").openPopup();

      latInput.style.backgroundColor = "#fffbe7";
      setTimeout(() => latInput.style.backgroundColor = "", 1000);
    }
  });

  // 6. Lat/Lng Display
  const coordDisplay = document.createElement('div');
  coordDisplay.className = 'lat-lng-display';
  coordDisplay.innerText = 'Lat: -, Lng: -';
  mapContainer.appendChild(coordDisplay);

  map.on('mousemove', function (e) {
    coordDisplay.innerText = `Lat: ${e.latlng.lat.toFixed(4)}, Lng: ${e.latlng.lng.toFixed(4)}`;
  });
}

function renderMapMarkers() {
  if (!map || !markerLayerGroup) return;

  // Clear existing markers
  markerLayerGroup.clearLayers();

  if (appData.scrapbook) {
    appData.scrapbook.forEach(item => {
      if (item.lat != null && item.lng != null) {
        const marker = L.marker([item.lat, item.lng]);
        marker.bindPopup(`<b>${item.destination}</b><br>${item.desc}<br><img src="${item.img}" style="width:100px;margin-top:5px;border-radius:8px;">`);
        markerLayerGroup.addLayer(marker);
      }
    });
  }
}

// --- Rendering Logic (Same as before, using appData) ---

function renderTimeline() {
  const container = document.querySelector('.timeline-container');
  if (!container) return;

  container.innerHTML = '';
  appData.timeline.forEach(item => {
    const el = document.createElement('div');
    el.className = 'timeline-item';
    el.setAttribute('data-year', item.year);
    el.innerHTML = `
      <div class="timeline-content">
        <h3>${item.title}</h3>
        <p>${item.desc}</p>
      </div>
    `;
    container.appendChild(el);
  });
}

function renderScrapbook() {
  const container = document.querySelector('.scrapbook-cards');
  if (!container) return;
  container.innerHTML = '';

  appData.scrapbook.forEach(item => {
    const el = document.createElement('div');
    el.className = 'scrapbook-card';
    el.setAttribute('data-id', item._id || item.id);

    el.innerHTML = `
      <img src="${item.img}" alt="${item.destination}" onerror="this.onerror=null;this.src='fallback.jpg';">
      <span>${item.destination}</span>
    `;
    el.addEventListener('click', () => openModal(item));
    container.appendChild(el);
  });
}

function renderBucketList() {
  const list = document.querySelector('.bucket-list-items');
  if (!list) return;
  list.innerHTML = '';

  appData.bucketList.forEach((item, index) => {
    const li = document.createElement('li');
    if (item.checked) li.classList.add('checked');

    li.innerHTML = `
      <label>
        <input type="checkbox" ${item.checked ? 'checked' : ''}>
        ${item.text}
      </label>
      <button class="delete-btn" aria-label="Delete">×</button>
    `;

    const checkbox = li.querySelector('input');
    checkbox.addEventListener('change', async () => {
      // Optimistic UI update
      item.checked = checkbox.checked;
      if (item.checked) li.classList.add('checked');
      else li.classList.remove('checked');

      // Sync with server
      const itemId = item._id || item.id;
      await fetch(`${API_URL}/bucketlist/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked: item.checked })
      });
    });

    const delBtn = li.querySelector('.delete-btn');
    delBtn.addEventListener('click', async () => {
      // Optimistic UI update
      appData.bucketList.splice(index, 1);
      renderBucketList();

      const itemId = item._id || item.id;
      await fetch(`${API_URL}/bucketlist/${itemId}`, { method: 'DELETE' });
    });

    list.appendChild(li);
  });
}

// --- Forms with API Calls ---

window.addNewTimeline = async function (event) {
  event.preventDefault();
  const form = event.target;
  const year = form.year.value;
  const desc = form.desc.value;

  if (year && desc) {
    const newItem = { year, title: year, desc };

    try {
      const res = await fetch(`${API_URL}/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
      if (res.ok) {
        // Refresh data to get correct sort order from server
        loadData();
        form.reset();
      }
    } catch (e) { console.error(e); }
  }
};

window.addNewScrapbook = async function (event) {
  event.preventDefault();
  const form = event.target;
  const dest = form.destination.value;
  let imgUrl = form.imgUrl.value;
  const desc = form.desc.value;
  const fileInput = form.imageFile;

  if (dest && desc) {
    try {
      // 1. Auto-Geocoding via Nominatim
      let lat = null;
      let lng = null;
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dest)}`);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData && geoData.length > 0) {
            lat = parseFloat(geoData[0].lat);
            lng = parseFloat(geoData[0].lon);
          }
        }
      } catch (geoErr) {
        console.warn('Geocoding failed:', geoErr);
      }

      // 2. Handle File Upload if present
      if (fileInput.files && fileInput.files[0]) {
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);

        const uploadRes = await fetch(`${API_URL}/upload`, {
          method: 'POST',
          body: formData
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          imgUrl = uploadData.url;
        } else {
          alert('Image upload failed, using placeholder.');
          imgUrl = `https://source.unsplash.com/300x300/?${dest}`;
        }
      } else if (!imgUrl) {
        imgUrl = `https://source.unsplash.com/300x300/?${dest}`;
      }

      const newItem = {
        id: Date.now().toString(),
        destination: dest,
        lat: lat,
        lng: lng,
        img: imgUrl,
        desc: desc,
        gallery: [imgUrl]
      };

      try {
        const res = await fetch(`${API_URL}/scrapbook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem)
        });
        if (res.ok) {
          const responseData = await res.json();
          appData.scrapbook.push(responseData.item);
          renderScrapbook();
          renderMapMarkers(); // Update markers on the map
          form.reset();
          alert(`Scrapbook added! Location: ${lat && lng ? 'Pinned on Map 📍' : 'Location not found ⚠️'}`);
        }
      } catch (e) { console.error(e); }
    } catch (e) { console.error(e); }
  }
};

window.addNewBucket = async function (event) {
  event.preventDefault();
  const form = event.target;
  const text = form.item.value;

  if (text) {
    const newItem = {
      id: Date.now().toString(),
      text: text,
      checked: false
    };

    try {
      const res = await fetch(`${API_URL}/bucketlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
      if (res.ok) {
        const responseData = await res.json();
        appData.bucketList.push(responseData.item);
        renderBucketList();
        form.reset();
      }
    } catch (e) { console.error(e); }
  }
};

// --- Modal Logic (Unchanged but ensuring it uses correct data) ---
const modal = document.getElementById('modal');
const modalImg = document.getElementById('modal-img');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const modalThumbnails = document.getElementById('modal-thumbnails');
const closeBtn = document.querySelector('.close-btn');

function openModal(item) {
  if (!modal) return;

  // Basic content
  modalTitle.innerHTML = item.destination; // Use innerHTML to allow inputs later
  modalDesc.innerHTML = item.desc;

  const images = item.gallery && item.gallery.length ? item.gallery : [item.img];
  modalImg.src = images[0];
  modalThumbnails.innerHTML = '';

  images.forEach((imgSrc, idx) => {
    const thumb = document.createElement('img');
    thumb.src = imgSrc;
    thumb.className = 'modal-thumb' + (idx === 0 ? ' active' : '');
    thumb.addEventListener('click', () => {
      modalImg.src = imgSrc;
      document.querySelectorAll('.modal-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
    });
    modalThumbnails.appendChild(thumb);
  });

  // Action Buttons Container
  let actionsDiv = document.getElementById('modal-actions');
  if (!actionsDiv) {
    actionsDiv = document.createElement('div');
    actionsDiv.id = 'modal-actions';
    actionsDiv.style.marginTop = '15px';
    actionsDiv.style.textAlign = 'center';
    // Insert after description
    modalDesc.parentNode.insertBefore(actionsDiv, modalDesc.nextSibling);
  }
  actionsDiv.innerHTML = ''; // Clear previous

  // Delete Button
  const deleteBtn = document.createElement('button');
  deleteBtn.innerText = '🗑️ Delete';
  deleteBtn.className = 'delete-btn-modal';
  deleteBtn.style.marginRight = '10px';
  deleteBtn.style.padding = '8px 16px';
  deleteBtn.style.backgroundColor = '#e74c3c';
  deleteBtn.style.color = 'white';
  deleteBtn.style.border = 'none';
  deleteBtn.style.borderRadius = '5px';
  deleteBtn.style.cursor = 'pointer';
  deleteBtn.onclick = async () => {
    // 2-Step Confirmation logic
    if (deleteBtn.innerText !== '⚠️ Confirm?') {
      deleteBtn.innerText = '⚠️ Confirm?';
      deleteBtn.style.backgroundColor = '#c0392b'; // Darker red/warning

      // Auto-reset after 3 seconds
      setTimeout(() => {
        if (modal.style.display !== 'none' && deleteBtn.innerText === '⚠️ Confirm?') {
          deleteBtn.innerText = '🗑️ Delete';
          deleteBtn.style.backgroundColor = '#e74c3c';
        }
      }, 3000);
      return;
    }

    // Actual Delete Logic
    const itemId = item._id || item.id;
    try {
      const res = await fetch(`${API_URL}/scrapbook/${itemId}`, { method: 'DELETE' });
      if (res.ok) {
        // Remove from local data
        appData.scrapbook = appData.scrapbook.filter(i => (i._id || i.id) !== itemId);
        renderScrapbook();
        renderMapMarkers();
        modal.style.display = 'none';
      } else {
        const errData = await res.json();
        alert('Failed to delete item: ' + (errData.error || 'Unknown error'));
      }
    } catch (e) {
      console.error(e);
      alert('Error connecting to server.');
    }
  };

  // Update Button
  const updateBtn = document.createElement('button');
  updateBtn.innerText = '✏️ Update';
  updateBtn.className = 'update-btn-modal';
  updateBtn.style.padding = '8px 16px';
  updateBtn.style.backgroundColor = '#f39c12';
  updateBtn.style.color = 'white';
  updateBtn.style.border = 'none';
  updateBtn.style.borderRadius = '5px';
  updateBtn.style.cursor = 'pointer';

  updateBtn.onclick = () => {
    // Switch to Edit Mode
    if (updateBtn.innerText.includes('Update')) {
      const currentDest = modalTitle.innerText;
      const currentDesc = modalDesc.innerText;

      modalTitle.innerHTML = `<input type="text" id="edit-dest" value="${currentDest}" style="width:100%; padding:5px; font-size:1.2rem;">`;
      modalDesc.innerHTML = `<textarea id="edit-desc" style="width:100%; height:100px; padding:5px;">${currentDesc}</textarea>`;

      updateBtn.innerText = '💾 Save';
      updateBtn.style.backgroundColor = '#2ecc71';
    } else {
      // Save Changes
      const newDest = document.getElementById('edit-dest').value;
      const newDesc = document.getElementById('edit-desc').value;
      const itemId = item._id || item.id;

      fetch(`${API_URL}/scrapbook/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: newDest, desc: newDesc })
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          // Update local data
          const idx = appData.scrapbook.findIndex(i => (i._id || i.id) === itemId);
          if (idx !== -1) {
            appData.scrapbook[idx] = data.item;
          }
          renderScrapbook();
          renderMapMarkers();

          // Revert UI
          modalTitle.innerText = newDest;
          modalDesc.innerText = newDesc;
          updateBtn.innerText = '✏️ Update';
          updateBtn.style.backgroundColor = '#f39c12';
        } else {
          alert('Update failed');
        }
      });
    }
  };

  actionsDiv.appendChild(deleteBtn);
  actionsDiv.appendChild(updateBtn);

  modal.style.display = 'flex';
}

if (closeBtn) closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

// --- Animation & UI ---
function animateTimeline() {
  const items = document.querySelectorAll('.timeline-item');
  const trigger = window.innerHeight * 0.85;
  items.forEach(item => {
    const rect = item.getBoundingClientRect();
    if (rect.top < trigger) item.classList.add('visible');
  });
}
window.addEventListener('scroll', animateTimeline);

const scrollBtn = document.getElementById('scroll-down-btn');
if (scrollBtn) {
  scrollBtn.addEventListener('click', () => {
    const nextSection = document.getElementById('timeline');
    if (nextSection) nextSection.scrollIntoView({ behavior: 'smooth' });
  });
}

const contactForm = document.getElementById('contact-form');
const formSuccess = document.getElementById('form-success');
if (contactForm) {
  contactForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const name = contactForm.name.value.trim();
    const email = contactForm.email.value.trim();
    const message = contactForm.message.value.trim();

    if (name && email && message) {
      try {
        const res = await fetch(`${API_URL}/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, message })
        });

        if (res.ok) {
          formSuccess.style.display = 'block';
          formSuccess.textContent = 'Thank you, ' + name + '! Postcard sent.';
          contactForm.reset();
          setTimeout(() => { formSuccess.style.display = 'none'; }, 4000);
        } else {
          alert('Failed to send message.');
        }
      } catch (err) {
        console.error(err);
        alert('Error connecting to server.');
      }
    }
  });
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  checkLoginState();
});

// --- Auth Logic ---
function checkLoginState() {
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const navLinks = document.querySelector('.nav-links');
  if (!navLinks) return;

  // Remove existing Login/Logout links to avoid duplicates
  const existingLogin = Array.from(navLinks.children).find(li => li.innerText.includes('Login'));
  if (existingLogin) existingLogin.remove();

  const existingLogout = document.getElementById('logout-btn');
  if (existingLogout) existingLogout.parentElement.remove();

  if (user) {
    // Show Logout
    const li = document.createElement('li');
    li.innerHTML = `<a href="#" id="logout-btn">Logout (${user.username})</a>`;
    navLinks.appendChild(li);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('user');
        window.location.href = 'index.html';
      });
    }
  } else {
    // Show Login
    const li = document.createElement('li');
    const isActive = window.location.pathname.includes('login.html') ? 'class="active"' : '';
    li.innerHTML = `<a href="login.html" ${isActive}>Login</a>`;
    navLinks.appendChild(li);
  }
}

// --- AI Planner Logic ---
const plannerForm = document.getElementById('planner-form');
let detectedKeywords = []; // Store AI analysis results

// --- Vision AI Logic ---
const visionInput = document.getElementById('vision-upload');
if (visionInput) {
  visionInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const img = document.getElementById('vision-img-preview');
    img.src = URL.createObjectURL(file);
    img.style.display = 'block';

    const status = document.getElementById('vision-result');
    status.innerHTML = '🧠 Analyzing image with Computer Vision...';

    try {
      // Load MobileNet
      const model = await mobilenet.load();
      const predictions = await model.classify(img);

      console.log('Predictions:', predictions);
      detectedKeywords = predictions.map(p => p.className);

      const topPrediction = predictions[0];
      status.innerHTML = `AI sees: <strong>${topPrediction.className}</strong> (${(topPrediction.probability * 100).toFixed(0)}%)`;

      // Auto-select style based on keywords
      const top = topPrediction.className.toLowerCase();
      const styleSelect = document.querySelector('select[name="style"]');

      if (top.includes('beach') || top.includes('sea') || top.includes('shore') || top.includes('sand')) styleSelect.value = 'relax';
      else if (top.includes('mountain') || top.includes('cliff') || top.includes('alps') || top.includes('valley')) styleSelect.value = 'adventure';
      else if (top.includes('palace') || top.includes('church') || top.includes('castle') || top.includes('building')) styleSelect.value = 'culture';
      else if (top.includes('food') || top.includes('fruit') || top.includes('vegetable') || top.includes('hot dog')) styleSelect.value = 'food';

    } catch (err) {
      console.error(err);
      status.innerText = 'Error analyzing image. Make sure you are online to load the AI model.';
    }
  });
}

if (plannerForm) {
  plannerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dest = plannerForm.destination.value;
    const days = parseInt(plannerForm.days.value);
    const style = plannerForm.style.value;
    const budget = plannerForm.budget.value;
    const travelers = plannerForm.travelers.value;
    const hotelName = plannerForm.hotel.value;

    const resultDiv = document.getElementById('itinerary-result');
    const contentDiv = document.getElementById('itinerary-content');

    // Loading State
    contentDiv.innerHTML = `
      <div style="text-align:center; padding: 20px;">
        <p style="font-size: 1.2rem;">🤖 <strong>AI Agent at Work...</strong></p>
        <p>📡 Fetching real-time data for <strong>${dest}</strong>...</p>
        <p>🏨 Locating accommodation: <strong>${hotelName || 'Central Hub'}</strong>...</p>
        <p>🌍 Analyzing top-rated places via OpenStreetMap & Wikipedia...</p>
        <p>📅 Optimizing schedule for a <strong>${budget}</strong> budget...</p>
      </div>
    `;
    if (detectedKeywords.length > 0) {
      contentDiv.innerHTML += `<p style="text-align:center; font-size:0.8em; color:#27ae60;">(Incorporating visual cues: ${detectedKeywords.slice(0, 3).join(', ')})</p>`;
    }
    resultDiv.style.display = 'block';

    try {
      const itineraryHelper = await generateItinerary(dest, days, style, detectedKeywords, budget, travelers, hotelName);
      contentDiv.innerHTML = itineraryHelper;
    } catch (err) {
      console.error(err);
      contentDiv.innerHTML = `<p style="color: red; text-align: center;">❌ Failed to generate itinerary. Please try a different destination or check your connection.</p>`;
    }

    // Enable Save Button
    const saveBtn = document.getElementById('save-itinerary-btn');
    if (saveBtn) {
      saveBtn.onclick = () => {
        const newItem = {
          id: Date.now().toString(),
          text: `Trip to ${dest} (${style}, ${budget})`,
          checked: false
        };
        // Reuse bucket list logic
        fetch(`${API_URL}/bucketlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem)
        }).then(() => {
          alert('Saved to your Bucket List!');
          window.location.href = 'bucketlist.html';
        });
      };
    }
  });
}

// --- Helper Functions for Data Fetching ---

async function fetchCoordinates(city) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`);
    if (!res.ok) throw new Error('Geo fetch failed');
    const data = await res.json();
    if (data && data.length > 0) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch (e) {
    console.warn('Coordinates fetch error:', e);
  }
  return null;
}

// Fetch nearby Wikipedia articles as "Places of Interest"
async function fetchPOIs(lat, lon) {
  // Radius of 10000m (10km) should cover most city centers
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=50&format=json&origin=*`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.query ? data.query.geosearch : [];
  } catch (e) {
    console.warn('Wiki POI fetch error:', e);
    return [];
  }
}

// --- Helper: Haversine Distance (Km) ---
function getDistKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --- Helper: Estimate Transport Cost ---
// Rule: Base Fee + (Km * Rate) * BudgetMult * GroupMult
function estTransportCost(distKm, budget, travelers) {
  let base = 2.0;
  let rate = 1.0; // per km

  if (budget === 'economy') { base = 1.50; rate = 0.50; } // Bus/Metro
  if (budget === 'standard') { base = 5.00; rate = 1.50; } // Uber/Taxi
  if (budget === 'luxury') { base = 15.00; rate = 3.00; } // Private Driver

  let cost = base + (distKm * rate);

  // Group Multipliers
  if (budget === 'economy') {
    if (travelers === 'couple') cost *= 2;
    if (travelers === 'family') cost *= 4;
    if (travelers === 'friends') cost *= 3;
  } else {
    if (travelers === 'family' || travelers === 'friends') cost *= 1.5;
  }

  return Math.max(cost, 2); // Minimum cost
}

async function generateItinerary(dest, days, style, keywords = [], budget, travelers, hotelName) {
  // 1. Get Destination Coordinates (City Center)
  const cityCoords = await fetchCoordinates(dest);
  if (!cityCoords) throw new Error("City not found");

  // 2. Identify Start Point (Hotel or Central Station)
  let startCoords = null;
  let startName = "";

  if (hotelName && hotelName.trim() !== "") {
    // Try to find specific hotel in that city
    // Append city name to ensure we find "Hilton Rome" not just "Hilton"
    const hotelQuery = `${hotelName}, ${dest}`;
    startCoords = await fetchCoordinates(hotelQuery);
    if (startCoords) {
      startName = hotelName;
    } else {
      // Fallback if hotel not found
      startName = `${dest} City Center (Hotel not found)`;
      startCoords = cityCoords;
    }
  } else {
    // User didn't give hotel -> Try Central Station
    const stationQuery = `${dest} Central Station`;
    const stationCoords = await fetchCoordinates(stationQuery);
    if (stationCoords) {
      startName = "Central Station / Transport Hub";
      startCoords = stationCoords;
    } else {
      // Fallback to generic city center
      startName = `${dest} City Center`;
      startCoords = cityCoords;
    }
  }

  // 3. POIs & Scoring
  // Fetch POIs around City Center (so we get best spots in town)
  let pois = await fetchPOIs(cityCoords.lat, cityCoords.lon);

  // Fallback
  if (pois.length === 0) {
    pois = [
      { title: 'Central Main Square', lat: cityCoords.lat + 0.001, lon: cityCoords.lon + 0.001 },
      { title: 'Historic Old Town', lat: cityCoords.lat - 0.002, lon: cityCoords.lon },
      { title: 'City Park', lat: cityCoords.lat, lon: cityCoords.lon - 0.002 }
    ];
  }

  // Style Logic
  const styleKeywords = {
    'adventure': ['park', 'mount', 'hill', 'trail', 'tower', 'bridge', 'zoo', 'forest'],
    'culture': ['museum', 'cathedral', 'church', 'palace', 'castle', 'theatre', 'opera', 'temple', 'monument'],
    'food': ['market', 'square', 'plaza', 'street', 'wharf'],
    'relax': ['garden', 'park', 'beach', 'lake', 'river', 'plaza']
  };
  const targetWords = styleKeywords[style] || [];

  let scoredPOIs = pois.map(p => {
    let score = 0;
    const titleLower = p.title.toLowerCase();
    if (targetWords.some(w => titleLower.includes(w))) score += 5;
    if (keywords.some(k => titleLower.includes(k.toLowerCase()))) score += 3;
    return { ...p, score };
  }).sort((a, b) => b.score - a.score);


  // 4. Build Days
  let html = '';
  let totalCost = 0;
  const fmt = (val) => `$${Math.round(val)}`;

  // Multiplier for food/activity costs
  const budgetMultipliers = { 'economy': 0.6, 'standard': 1.0, 'luxury': 2.5 };
  const mult = budgetMultipliers[budget] || 1.0;

  const timeSlots = [
    { time: '09:00 - 11:00', label: 'Morning Activity', costBase: 15 },
    { time: '11:30 - 13:00', label: 'Lunch Break', costBase: 20 },
    { time: '13:30 - 16:00', label: 'Afternoon Exploration', costBase: 15 },
    { time: '16:30 - 18:00', label: 'Sunset / Relax', costBase: 10 },
    { time: '19:00 - 21:00', label: 'Dinner', costBase: 35 }
  ];

  let poiIndex = 0;

  for (let i = 1; i <= days; i++) {
    html += `
        <div class="day-plan" style="margin-bottom: 25px; border: 1px solid #ffb347; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="background: #ffb347; padding: 10px 20px; color: white;">
                <h3 style="margin:0; font-family:'Pacifico', cursive;">Day ${i}</h3>
                <div style="font-size:0.8em; opacity:0.9;">Starting from: <strong>${startName}</strong></div>
            </div>
            <div style="background: #fff; padding: 20px;">
        `;

    let dayTotal = 0;

    // Tracking Location
    let currentLat = startCoords.lat;
    let currentLon = startCoords.lon;
    let prevLocName = startName;

    for (let slot of timeSlots) {
      let activityName = '';
      let cost = 0;
      let nextLat = currentLat;
      let nextLon = currentLon;
      let locationName = "Nearby";

      if (slot.label.includes('Lunch') || slot.label.includes('Dinner')) {
        activityName = `Enjoy a local meal (${budget} style)`;
        cost = slot.costBase * mult;
        // Add Travelers multiplier for food
        if (travelers === 'couple') cost *= 2;
        if (travelers === 'family') cost *= 4;
        if (travelers === 'friends') cost *= 3;
        locationName = "Local Restaurant";
        // Assume restaurant is close to previous spot (0.5km walk/short ride)
      } else {
        if (poiIndex < scoredPOIs.length) {
          const place = scoredPOIs[poiIndex];
          activityName = `Visit <strong>${place.title}</strong>`;
          nextLat = place.lat;
          nextLon = place.lon;
          locationName = place.title;
          poiIndex++;
        } else {
          activityName = 'Explore the city center';
          nextLat = cityCoords.lat;
          nextLon = cityCoords.lon;
          locationName = "City Center";
        }
        cost = (budget === 'economy' ? 5 : slot.costBase * mult);
        if (travelers === 'couple') cost *= 2;
        if (travelers === 'family') cost *= 3;
      }

      // CALC TRANSPORT
      // If moving to a new coordinate OR just going to a restaurant (assume short trip)
      let dist = 0.5; // default short hop
      if (locationName !== "Local Restaurant") {
        dist = getDistKm(Number(currentLat), Number(currentLon), Number(nextLat), Number(nextLon));
      }

      let transCost = estTransportCost(dist, budget, travelers);

      // Update Totals
      dayTotal += transCost;
      dayTotal += cost;

      html += `
              <div style="display: flex; gap: 15px; margin-bottom: 12px; align-items: flex-start; border-bottom: 1px dashed #eee; padding-bottom: 8px;">
                  <div style="min-width: 100px; font-weight: bold; color: #d35400;">${slot.time}</div>
                  <div style="flex-grow: 1;">
                      <div style="font-weight: 600; color: #2c3e50;">${activityName}</div>
                      <div style="font-size: 0.85em; color: #7f8c8d;">${slot.label}</div>
                      
                      <div style="margin-top:4px; font-size: 0.8em; color: #8e44ad; background: #f4ecf7; display: inline-block; padding: 2px 6px; border-radius: 4px;">
                        🚕 Trip from <strong>${prevLocName}</strong> (${dist.toFixed(1)}km): ~${fmt(transCost)}
                      </div>
                  </div>
                  <div style="font-weight: bold; color: #27ae60; white-space: nowrap;">
                    <div>Activity: ~${fmt(cost)}</div>
                  </div>
              </div>
          `;

      // Update State
      if (locationName !== "Local Restaurant") {
        currentLat = nextLat;
        currentLon = nextLon;
        prevLocName = locationName;
      } else {
        prevLocName = "Restaurant";
      }
    } // end timeSlots

    // Return to Hotel
    const returnDist = getDistKm(Number(currentLat), Number(currentLon), Number(startCoords.lat), Number(startCoords.lon));
    const returnCost = estTransportCost(returnDist, budget, travelers);
    dayTotal += returnCost;

    html += `
            <div style="text-align: right; font-size: 0.85em; color: #8e44ad; margin-bottom: 10px; padding-right: 10px;">
                🚕 Return Trip to ${startName} (${returnDist.toFixed(1)}km): ~${fmt(returnCost)}
            </div>
            <div style="text-align: right; margin-top: 10px; font-weight: bold; color: #e67e22;">
                Day Total: ${fmt(dayTotal)}
            </div>
        </div></div>`;

    totalCost += dayTotal;
  }

  // 5. Travel Preparation Section
  const prepHtml = `
    <div style="background: #eaf2f8; padding: 20px; border-radius: 12px; margin-bottom: 30px; border-left: 5px solid #3498db;">
        <h3 style="margin-top: 0; color: #2980b9;">🧳 Travel Essentials for ${dest}</h3>
        <ul style="padding-left: 20px;">
            <li><strong>Preparation:</strong> Check visa requirements for the country.</li>
            <li><strong>Transport:</strong> <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}" target="_blank">Check Flights/Trains on Google Maps</a></li>
            <li><strong>Packing:</strong> Bring comfortable walking shoes for the detailed itinerary!</li>
            <li><strong>Budget Tip:</strong> Since you chose <strong>${budget}</strong>, try using local public transport instead of taxis.</li>
            <li><strong>Family/Group:</strong> Ensure you book restaurant tables in advance for larger groups.</li>
        </ul>
    </div>
  `;

  const summaryHtml = `
    ${prepHtml}
    <div style="background: #e8f8f5; border: 2px solid #2ecc71; padding: 20px; border-radius: 12px; margin-bottom: 30px; text-align: center; box-shadow: 0 4px 10px rgba(46, 204, 113, 0.2);">
        <h2 style="margin: 0; color: #27ae60; font-family:'Pacifico', cursive;">Total Trip Estimate: ${fmt(totalCost)}</h2>
        <p style="margin: 5px 0 0 0; color: #555;">(Includes food & activities for ${travelers} travel group)</p>
    </div>
  `;

  return summaryHtml + html;
}


// Register Form
const registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = registerForm.username.value;
    const password = registerForm.password.value;
    const errorDiv = document.getElementById('auth-error');

    try {
      const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = 'index.html';
      } else {
        errorDiv.textContent = data.error;
      }
    } catch (err) {
      console.error(err);
      errorDiv.textContent = 'Connection error: ' + err.message;
    }
  });
}

// Login Form
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = loginForm.username.value;
    const password = loginForm.password.value;
    const errorDiv = document.getElementById('auth-error');

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = 'index.html';
      } else {
        errorDiv.textContent = data.error;
      }
    } catch (err) {
      errorDiv.textContent = 'Connection error';
    }
  });
}