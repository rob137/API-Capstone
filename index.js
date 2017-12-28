'use strict';

let map, heatmapLatLngsArr, heatmap;

// Takes user input (location and place type) and calls handleGoClick.
function listenForGoClick() {
  console.log('listenForGoClick');
  $('.js-go-button').on('click', function(event) {
    // Will only act if user has typed into the search box.
    if ($('.js-search-box').val()) {
      event.preventDefault();
      let locationString = $('.js-search-box').val(); // note that this line creates a jquery error when loaded from the index.html file from harddrive, but shouldn't once source code is hosted elsewhere.
      let placeType = $('.js-select-place-type :selected').text();
      handleGoClick(locationString, placeType); 
    }
  });
}

// Shows/hides heatmap layer
function handleToggleHeatmapClick() {
  $('.js-toggle-button').on('click', function(event) {
    event.preventDefault();
    if (heatmap.map) {
      // hides the heatmap layer
      heatmap.setMap(null);
    } else {
      // shows the heatmap layer
      heatmap.setMap(map);
    }
  });
}

// Starts the chain of functions.
// Note that many of the other functions are set off by checkProposedLocationIsValid.
// This is due to the wait time for the Geocode JSON request.
function handleGoClick(locationString, placeType) {
  console.log('handleGoClick');
  let geocodeUrl = makeGeocodeUrl(locationString);
  getAndCheckLocationJson(geocodeUrl);

  // !!!!!!!!!!!!!!!!!!!!!!!!!! Changing DOM here! !!!!!!!!!!!!!!!!!!!!!!!!!!
  showResults();
}

// Makes the Url used in getAndCheckLocationJson().
function makeGeocodeUrl(locationString) {
  console.log('makeGeocodeUrl');
  return `https://maps.googleapis.com/maps/api/geocode/json?key=AIzaSyAwrO9kTCuS6Zimy4p4zCZMa-UUsgJ_7OU&address=${locationString}`;
}

// JSON request for GeoJson immediately followed by error-check.
// (Executing checkProposedLocationIsValid() outside of the getJSON
// request seems to prevent the error checks from working.)
function getAndCheckLocationJson(geocodeUrl) {
  console.log('getAndCheckLocationJson');
  $.getJSON(geocodeUrl, function(json) {
    let locationJson = json;
    checkProposedLocationIsValid(locationJson)
  })
}

// Checks that the location exists on Google's API.
// If so, sets off a bunch of other functions .
function checkProposedLocationIsValid(locationJson) {
  console.log('checkProposedLocationIsValid');
  if (locationJson.status == "ZERO_RESULTS") {
    // Either show an error if it isn't on Google's API... 
    console.log('Proposed location is invalid.')
    displayNoSuchLocationErrorMessage();
  } else {
    // ... Else, continiue this app's chain of functions.
    console.log('Proposed location is valid.')
    // In case the error message is already displayed
    removeNoSuchLocationErrorMessage();
    let locationObject = locationJson.results[0];
    // Center the map
    goToLocation(locationObject);
    handleNewHeatmapRequest(locationObject);
    // Switched off to make testing easier:
    // revealMap();
  }
}

// Presents error to user when location isn't in database.
function displayNoSuchLocationErrorMessage() {
  console.log('displayNoSuchLocationErrorMessage');
  let noSuchLocationErrorMessage = `Sorry, that location isn't available. <br> Please try another.`;
  $('.js-no-such-location-error-message').html(noSuchLocationErrorMessage)
}
// When the user submits a valid location.
function removeNoSuchLocationErrorMessage() {
  let noSuchLocationErrorMessage;
  $('.js-no-such-location-error-message').html('<br><br>');
}

// Centers map on new location.
function goToLocation(locationObject) {
  console.log('goToLocation');
  if (locationObject.geometry.viewport) {
    // If available, consider the location's size to help set zoom level...
    setMapViewportUsingBounds(locationObject)
  } else {
    // ... Else, just center viewport on the location. 
    setMapViewportUsingCenterPoint();
  }
}

// Uses location's bounds to set appropriate zoom level.
function setMapViewportUsingBounds(locationObject) {
  console.log('setMapViewportUsingBounds');
  var bounds = new google.maps.LatLngBounds();
  // Use location's northwest and southeast extremes to set zoom: 
  bounds.extend(locationObject.geometry.viewport.northeast);
  bounds.extend(locationObject.geometry.viewport.southwest);
  map.fitBounds(bounds);
}

// If the above isn't an option, this simply centres on the location.
function setMapViewportUsingCenterPoint(locationJson) {
  console.log('setMapViewportUsingCenterPoint');
  map.setCenter(locationJson.results[0]);
}

// Calls Google Places API GET request and then calls for heatmap generation 
function handleNewHeatmapRequest(locationObject, radius) {
  console.log('handleNewHeatmapRequest');
  let locationLatLng;
  if (locationObject.geometry) {
    locationLatLng = makeLocationLatLngForPlacesRequest(locationObject);
  } else {
    locationLatLng = locationObject;
  }
  let placeType = $('option:selected').val();

  if (!locationObject.geometry) {
    // For example displayed on initial pageload.  Loads slowly, causing
    // potential flow control issues.  Therefore is manually assigned here. 
    radius = 2000;
  } else {
    // For all subsequent searches. 
    radius = getRadiusForPlacesRequest();
  }
  requestPlacesJson(locationLatLng, placeType, radius);
  createHeatmap();
}

// Creates the right object format for location requests to Google's API 
function makeLocationLatLngForPlacesRequest(locationObject) {
  console.log('makeLocationLatLngForPlacesRequest');
  let locationLatLng
    // User can either query a search term by clicking Autocomplete suggestion,
    // or by clicking 'go'.
    // Autocomplete serves locationObject.geometry.location.lat/lng as functions 
    // that return the lat/lng value.  Alternatively, when the user clicks 'go', 
    // they are instead served numerical lat/lng values.  
  if (typeof locationObject.geometry.location.lat == 'function') {
    // For Autocomplete
    locationLatLng = {
      lat: locationObject.geometry.location.lat(),
      lng: locationObject.geometry.location.lng()
    }
  } else {
    // For user clicking 'go'
    locationLatLng = {
      lat: locationObject.geometry.location.lat,
      lng: locationObject.geometry.location.lng
    }
  }
  return locationLatLng;
}

// Ensures heatmap results are drawn from visible map. 
// Does it by assigning viewport size to 'radius' used in
// the GET request to Google's API.
function getRadiusForPlacesRequest() {
  console.log('getRadiusForPlacesRequest');
  let bounds = map.getBounds();
  let center = bounds.getCenter();
  let ne = bounds.getNorthEast();
  // r = radius of the earth in statute miles
  let r = 3963.0;
  // Convert lat or lng from decimal degrees into radians (divide by 57.2958)
  let lat1 = center.lat() / 57.2958;
  let lon1 = center.lng() / 57.2958;
  let lat2 = ne.lat() / 57.2958;
  let lon2 = ne.lng() / 57.2958;
  // distance = circle radius from center to Northeast corner of bounds
  let dis = r * Math.acos(Math.sin(lat1) * Math.sin(lat2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1)) * 1000;
  return dis;
}

// Requests places and makes a heatmapArr for createHeatmap().
function requestPlacesJson(locationLatLng, placeType, radius) {
  console.log('requestPlacesJson');
  let service = new google.maps.places.PlacesService(map);
  let request = {
    location: locationLatLng,
    radius: radius,
    type: placeType
  }
  service.nearbySearch(request, function(result) {
    heatmapLatLngsArr = makeLatLngsFromPlacesJson(result);
    createHeatmap(heatmapLatLngsArr);
  });
}

// creates lat/lngs object in the format accepted by the API.
function makeLatLngsFromPlacesJson(json) {
  console.log('makeLatLngsFromPlacesJson');
  let heatmapLatLngsArr = [];
  for (let item in json) {
    let lat = json[item].geometry.location.lat;
    let lng = json[item].geometry.location.lng;
    heatmapLatLngsArr.push(new google.maps.LatLng(lat(), lng()));
  }
  return heatmapLatLngsArr;
}

// Final function in the chain... Makes heatmap!
// Note that we make a single heatmap layer
// and reuse it for subsequent searches.
function createHeatmap(heatmapLatLngsArr) {
  console.log('createHeatmap');
  if (!heatmap) {
    // For the first layer - makes our heatmap layer.
    heatmap = new google.maps.visualization.HeatmapLayer({
      data: heatmapLatLngsArr,
      map: map,
      radius: 50,
      opacity: 0.5
    });
  } else {
    // For every subsequent search - replaces our heatmap data 
    // with new data.
    let newData = new google.maps.MVCArray(heatmapLatLngsArr);
    heatmap.data = newData;
    // In case the heatmap is currently hidden:
    heatmap.setMap(map);
  }
}

// Adds autocomplete functionality to search bar.
// Called when Google Maps API is finished loading (see initMap, below).
function prepareAutocomplete() {
  console.log('prepareAutocomplete');
  let input = document.getElementById('js-search-box')
  let autocomplete = new google.maps.places.Autocomplete(input);
  // Bind the map's bounds (viewport) property to the autocomplete object,
  // so that the autocomplete requests use the current map bounds for the
  // bounds option in the request.
  autocomplete.bindTo('bounds', map);
  autocomplete.addListener('place_changed', function() {
    let place = autocomplete.getPlace();
    if (place.geometry.viewport) {
      // uses viewport coords (if place object has them) to bound map.
      map.fitBounds(place.geometry.viewport);
    } else {
      // else just center on the location
      map.setCenter(place.geometry.location);
    }
  });
}


// Called when Google API finishes loading.  Kickstarts the page with
// initial map/heatmap and calls prepareAutocomplete().  
function initMap() {
  console.log('initMap');
  // Initial lat/lng for pageload
  let startLatLng = {
    lat: 51.5032,
    lng: -0.1123
  };
  // Create Google Map centered on startLatLng. 
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 13,
    center: startLatLng,
    mapTypeControlOptions: {
      style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
      position: google.maps.ControlPosition.BOTTOM_LEFT,
    }
  });
  

  // Add autocomplete functionality to searchbar.
  prepareAutocomplete()
  // Create heatmap layer for initial map position.
  handleNewHeatmapRequest(startLatLng);
}
$('.js-search-box').focus()
listenForGoClick();
handleToggleHeatmapClick();




/* ------------- Currently Deactivated [begins] ------------- */
// Hides background layer.
// Background layer is hidden for now because it makes testing 
// the app less easy.  Might remove anyway for UX reasons.
function revealMap() {
  $('.background-shading').remove();
  $('.main').html('');
}

// Creates and (asynchronously) loads buttons.
// Deactivated for now.  Possibly to be removed and replaced
// by persistant buttons I will eventually add to <main> in index.html.
function generateMapPlaceTypeButtonsHtml() {
  console.log('generateMapPlaceTypeButtonsHtml');
  let dashboardHtml =
    `<ul class="place-type-buttons">
      <li><button class="js-place-type-button">test</button></li>
      <li><button class="js-place-type-button">test</button></li>
      <li><button class="js-place-type-button">test</button></li>
      <li><button class="js-place-type-button">test</button></li>
    </ul>`
  $('main').append(dashboardHtml);
}
/* ------------- Currently Deactivated [ends] ------------- */

// Additional Google Maps heatmap controls available online:
// https://developers.google.com/maps/documentation/javascript/examples/layer-heatmap
