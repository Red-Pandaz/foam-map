document.addEventListener('DOMContentLoaded', async function () {
    try {
        const response = await fetch('/api/markers', {
            credentials: 'include'
        });
        if (!response.ok) {
console.log(response)
            throw new Error('Failed to fetch marker data');
        }

        const markers = await response.json();
        const groupedMarkers = {};
        markers.forEach(data => {
            const key = data.geoHashLocation; // Use geoHashLocation as the key
            if (!groupedMarkers[key]) {
                // If the key doesn't exist, create a new entry with an empty array
                groupedMarkers[key] = {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [data.latlonLocation.longitude, data.latlonLocation.latitude]
                    },
                    properties: { claims: [] }
                };
            }

            // Add properties of the current marker to the properties array
            groupedMarkers[key].properties.claims.push({
                id: data._id,
                transactionHash: data.transactionHash,
                minter: data.minter,
                timestamp: data.timestamp,
                zone: data.zone,
                zoneName: data.zoneName,
                distinctAnchors: data.distinctAnchors,
                localizationGrade: data.localizationGrade,
                bytes20Location: data.bytes20Location,
                geoHashLocation: data.geoHashLocation,
                latitude: data.latlonLocation.latitude,
                longitude: data.latlonLocation.longitude,
                altitude: data.altitude
            });
        });

        // Extract the values (grouped markers) from the object
        let geoJsonFeatures = Object.values(groupedMarkers);
        geoJsonFeatures.forEach(function (geoJsonFeature) {
            geoJsonFeature.properties.number = geoJsonFeature.properties.claims.length;
        });

        const tokenResponse = await fetch('/token');
        if (!tokenResponse.ok) {
            throw new Error('Failed to fetch Mapbox token');
        }
        const data = await tokenResponse.json();
        const mapboxToken = data.token;
        // Use the token with Mapbox GL JS
        mapboxgl.accessToken = mapboxToken;
        // Now you can create your map instance
        const map = new mapboxgl.Map({
            style: 'mapbox://styles/mapbox/dark-v11',
            container: 'map', // container ID
            center: [-98.583333, 39.833333], // starting position [lng, lat]
            zoom: 3, // starting zoom
            projection: 'globe',
        });

        map.on('load', function () {
            fetch('https://static.optimism.io/data/FOAM/logo.svg')
                .then(response => response.blob())
                .then(blob => {
                    const image = new Image();
                    image.src = URL.createObjectURL(blob);
                    image.onload = () => {
                        map.addImage('FOAM-marker', image);
                        map.addSource('markers', {
                            type: 'geojson',
                            data: {
                                type: 'FeatureCollection',
                                features: geoJsonFeatures
                            }
                        });
                        map.addLayer({
                            id: 'markers',
                            type: 'symbol',
                            source: 'markers',
                            layout: {
                                'icon-image': 'FOAM-marker',
                                'icon-size': [
                                    'interpolate',
                                    ['linear'],
                                    ['coalesce', ['get', 'number']],
                                    0, .02,
                                    2, .030,
                                    5, .04,
                                    10, .05
                                ],
                                'icon-allow-overlap': true
                            }
                        });
                        const loadingPage = document.getElementById('loading-page');
                        loadingPage.style.display = 'none';
                        const [coordinates, tx] = getCoordinatesFromUrl();
                        if (coordinates) {
                            
                            const offset = [0, -window.innerHeight / 3];
                            map.flyTo({
                                center: [coordinates.lng, coordinates.lat],
                                zoom: 15,
                                offset: offset,
                            });
    
                            geoJsonFeatures.forEach(feature => {
                                const [lng, lat] = feature.geometry.coordinates;
                                if (lng === coordinates.lng && lat === coordinates.lat) {
                                    const popupContent = getPopupContent(feature);
                                    const popup = new mapboxgl.Popup({
                                        offset: 25,
                                        maxWidth: '90vw',
                                        anchor: 'top'
                                    })
                                        .setHTML(popupContent)
                                        .setLngLat([lng, lat])
                                        .addTo(map);
    
                                    attachCollapsibleEventListeners();
    
                                    setTimeout(() => {
                                        const selectTx = document.querySelector(`#${tx}`);
                                        if (selectTx) {
                                            selectTx.style.display = 'block';
                                            selectTx.scrollIntoView({ behavior: 'smooth', block: 'center' });                               
                                        } else {
                                            console.error(`Element with ID ${tx} not found`);
                                        }
                                    }, 100);
                                }
                            });
                        }
                    };
                })
                .catch(error => {
                    console.error('Error fetching image:', error);
                });
    
            map.on('click', 'markers', function (e) {
                const features = map.queryRenderedFeatures(e.point, { layers: ['markers'] });
                if (features.length) {
                    const feature = features[0];
                    const popupContent = getPopupContent(feature);
                    const popup = new mapboxgl.Popup({
                        offset: 25,
                        maxWidth: '90vw',
                        anchor: 'top'
                    })
                        .setHTML(popupContent)
                        .setLngLat(e.lngLat)
                        .addTo(map);
    
                    attachCollapsibleEventListeners();
                }
            });
        });    

    } catch (error) {
        console.error('Error fetching marker data:', error);
        // Handle error
    }
});

function countUniqueGeoHashLocations(data) {
    const uniqueGeoHashLocations = new Set();
    data.forEach(entry => uniqueGeoHashLocations.add(entry.properties.claims.geoHashLocation));
    return uniqueGeoHashLocations.size;
}

function getCoordinatesFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const lat = parseFloat(params.get('lat'));
    const lng = parseFloat(params.get('lng'));
    const tx = params.get('tx');
    if (window.location.search) {
        // Remove the query parameters without refreshing the page
        history.replaceState(null, '', window.location.origin + window.location.pathname);
    }
    if (!isNaN(lat) && !isNaN(lng)) {
        return [{ lat, lng }, tx];
    }
    return [null, null];
}

function getPopupContent(feature) {
    let newFeature = feature.properties.claims;
    if (typeof (newFeature) === 'string') {
        newFeature = JSON.parse(newFeature);
    }
    newFeature = newFeature.sort((a, b) => b.timestamp - a.timestamp);
    let returnString = `<h3>Geohash: ${newFeature[0].geoHashLocation}</h3><h3>Coordinates: ${newFeature[0].latitude}, ${newFeature[0].longitude}</h3>`;

    newFeature.forEach(function (claim) {
        const timestamp = claim.timestamp;
        const date = new Date(timestamp);
        const months = [
            "January", "February", "March", "April", "May", "June", "July",
            "August", "September", "October", "November", "December"
        ];
        const month = months[date.getMonth()];
        const day = date.getDate();
        const year = date.getFullYear();
        const hour = date.getUTCHours();
        const minute = date.getUTCMinutes();
        const second = date.getUTCSeconds();
        const parsedTimestamp = `${month} ${day} ${year} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')} UTC`;

        let claimString = '';
        if (newFeature.length === 1) {
            claimString = `<h4>${parsedTimestamp}</h4>
                <ul id="${claim.transactionHash.substring(1)}">
                    <li>Claim ID: ${claim.id}</li>
                    <li>Tx Hash: <a href="https://devnet-l2.foam.space/tx/${claim.transactionHash}">${claim.transactionHash}</a></li>
                    <li>Minted By: <a href="https://devnet-l2.foam.space/address/${claim.minter}">${claim.minter}</a></li>
                  <li>Zone Number: ${claim.zone}  (Zone Name: ${claim.zoneName})</li>
                    <li>Localization Grade: ${claim.localizationGrade}  (Distinct Anchors: ${claim.distinctAnchors})</li>
                    <li>Altitude: ${claim.altitude}</li>
                </ul>`;
        } else {
            claimString = `<button type="button" class="collapsible">${parsedTimestamp}</button>`;
            claimString += `
                <ul class="content" id="${claim.transactionHash.substring(1)}">
                    <li>Claim ID: ${claim.id}</li>
                    <li>Tx Hash: <a href="https://devnet-l2.foam.space/tx/${claim.transactionHash}">${claim.transactionHash}</a></li>
                    <li>Minted By: <a href="https://devnet-l2.foam.space/address/${claim.minter}">${claim.minter}</a></li>
                    <li>Zone Number: ${claim.zone}  (Zone Name: ${claim.zoneName})</li>
                    <li>Localization Grade: ${claim.localizationGrade}  (Number of Distinct Anchors: ${claim.distinctAnchors})</li>
                    <li>Altitude: ${claim.altitude}</li>
                </ul>`;
        }
        returnString += claimString;
    });

    return returnString;
}

function attachCollapsibleEventListeners() {
    document.querySelectorAll('.collapsible').forEach(collapsible => {
        collapsible.addEventListener('click', function () {
            this.classList.toggle('active');
            const content = this.nextElementSibling;
            if (content.style.display === 'block') {
                content.style.display = 'none';
            } else {
                content.style.display = 'block';
                console.log('block');
                // Use a small delay to ensure the content is displayed before scrolling
                setTimeout(() => {
                    content.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 10); // 10ms delay
            }
        });
    });
}
