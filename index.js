'use strict';

let map, heatmapLatLngsArr, heatmap, userPosition, userLocationLatLngObject, marker, youAreHereLabel, aggregateSearchResultsArr = [],
  uniqueSearchResultsArr = [];

// Initial lat/lng for pageload (used to demonstrate search, if app can't geolocate user)
let defaultLatLng = {
  lat: 51.5032,
  lng: -0.1123
};

// Initiates listeners - called on pageload
function startListeningForUserInput() {
  listenForStartClick();
  listenForSearchClick();
  listenForHelpFocus()
  listenForReturnOnSearch();
  listenForToggleShowResultsButtonClick();
  listenForUserClickOnResults();
  listenForUserClickOnCloseNoSuchLocationErrorMessage();
}

function listenForStartClick() {
  $('.start-button').on('click', function(event) {
    revealApp();
  });
}

// Removes the landing page and shows the app
function revealApp() {
  $('main').show();
  $('.background-shroud').hide();
  $('.welcome-screen').hide();
  if (youAreHereLabel) {
    // Hides 'you are here' label after 2 seconds
    hideYouAreHereLabel();
  }
}

// removes 'you are here' label
function hideYouAreHereLabel() {
  setTimeout(function() {
    youAreHereLabel.close();
  }, 2000);
}

function listenForSearchClick() {
  $('.js-go-button').on('click', function(event) {
    event.preventDefault();
    // Will only function if user has typed something into the search box.
    initiateSearchFunctions();
  });
}

function listenForReturnOnSearch() {
  $('.js-search-box').keydown(function(event) {
    if (event.which == 13) {
      event.preventDefault()
    // Will only function if user has typed something into the search box.
      initiateSearchFunctions();
    }
  })
}

// Note: 
// Starts the chain of functions involved in searching 
// and displaying a heatmap. Continues until createHeatmap().

// Takes the location search term from the top of the UI 
// and uses it to perform a search request.
function initiateSearchFunctions() {
  // Only runs if the inputs are filled out.
  if ($('.js-search-box').val()) {
    let locationString = $('.js-search-box').val();
    let geocodeUrl = makeGeocodeUrl(locationString);
    getAndCheckLocationJson(geocodeUrl);
  }
}

// Makes the Url used in getAndCheckLocationJson().
function makeGeocodeUrl(locationString) {
  return `https://maps.googleapis.com/maps/api/geocode/json?key=AIzaSyAwrO9kTCuS6Zimy4p4zCZMa-UUsgJ_7OU&address=${locationString}`;
}

// JSON request immediately followed by error-check.
// (Executing checkProposedLocationIsValid() outside of the getJSON
// request seems to prevent the error checks from working.)
function getAndCheckLocationJson(geocodeUrl) {
  $.getJSON(geocodeUrl, function(json) {
    let locationJson = json;
    checkProposedLocationIsValid(locationJson);
  })

}
// Checks that the location exists on Google's API.
// If so, continues the chain of functions.
function checkProposedLocationIsValid(locationJson) {
  if (locationJson.status == "ZERO_RESULTS") {
    // Show an error if it isn't on Google's API... 
    displayNoSuchLocationErrorMessage();
  } else {
    let locationObject = locationJson.results[0];
    // Center the map
    goToLocation(locationObject);
    checkNeedForRecentering();
    makeNewPlacesRequest(locationObject);
  }
}

// Pulls together data for request, then makes request.
function makeNewPlacesRequest(locationObject) {
  removeNoSuchLocationErrorMessage();

  // Data for request: 
  let locationLatLng, radius, placeCategory;
  locationLatLng = makeLatLngObject(locationObject);
  radius = getviewportRadius();
  placeCategory = getCategory();

  // Resetting aggregateSearchResultsArr for imminent search
  aggregateSearchResultsArr = [];
  uniqueSearchResultsArr = [];

  // Making request:
  if (typeof placeCategory == 'string') {
    requestPlacesJson(locationLatLng, placeCategory, radius);
  } else {
    requestPlacesJson(locationLatLng, placeCategory, radius, true);
  }
}

// Retrieves category from DOM
function getCategory() {
  $('.js-select-place-type :selected')
  let placeCategory, placeCategorySelection = $('.js-select-place-type :selected');
  if ($(placeCategorySelection).hasClass('collection')) {
    // For collections of categories - eg 'culture'
    placeCategory = $(placeCategorySelection).attr('value').split(',');
  } else {
    // for individual categories - eg 'cafe'
    placeCategory = $(placeCategorySelection).attr('value');
  }
  return placeCategory;
}

// Sets radius to a quarter of the current viewport size - to ensure 
// that the search area is appropriate for the user's perspective.
function getviewportRadius() {
  let northEastBoundLatLngObject = {
    lat: map.getBounds().getNorthEast().lat,
    lng: map.getBounds().getNorthEast().lng
  }
  let southWestBoundLatLngObject = {
    lat: map.getBounds().getSouthWest().lat,
    lng: map.getBounds().getSouthWest().lng
  }
  let radius = google.maps.geometry.spherical
    .computeDistanceBetween(northEastBoundLatLngObject, southWestBoundLatLngObject) / 4;
  return radius;
}

// Ensures heatmap results are drawn from visible map. 
// Does it by assigning viewport size to 'radius' used in
// the GET request to Google's API.
function getRadiusForPlacesRequest() {
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

// Directs to different functions for collections (culture) and individual categories (church)
function requestPlacesJson(locationLatLng, placeCategory, radius, collection) {
  let service = new google.maps.places.PlacesService(map);
  if (collection) {
    getJsonForCollectionOfCategories(locationLatLng, placeCategory, radius, service);
  } else {
    getJsonForIndividualCategory(locationLatLng, placeCategory, radius, service);
  }
}

// For collections of category - eg 'Culture' etc
function getJsonForCollectionOfCategories(locationLatLng, placeCategory, radius, service) {
  for (let subtype in placeCategory) {
    // define request for each subtype
    let request = prepareRequest(locationLatLng, placeCategory[subtype], radius);
    // Make request to Places library!
    service.nearbySearch(request, function(results) {
      if (results && results.length > 0) {
        // Combine results and remove duplicates
        combineResults(results, aggregateSearchResultsArr);
        uniqueSearchResultsArr = filterResults(aggregateSearchResultsArr);
      }
    });
  }
  // Wait for all json requests to be fulfilled - can be 5+ requests depending on category.
  setTimeout(function() {
    presentSearchResults(uniqueSearchResultsArr)
  }, 1500)  
} 

// For individual categories - eg 'art_gallery' etc
function getJsonForIndividualCategory(locationLatLng, placeCategory, radius, service) {
  let request = {
    location: locationLatLng,
    radius: radius,
    type: placeCategory
  }
  service.nearbySearch(request, function(results) {
    presentSearchResults(results);
    uniqueSearchResultsArr = results;
  })
}

function presentSearchResults(results) {
  alphabeticallyOrderResults(results)
  showResultsInSidebar(results);
  heatmapLatLngsArr = makeLatLngsFromPlacesJson(results); 
  createHeatmap(heatmapLatLngsArr);
}

// Used to aggregate results into aggregateSearchResultsArr
function combineResults(results, arr) {
  for (let result in results) {
    arr.push(results[result]);
  }
  return arr;
}

// Returns an array of unique search results
function filterResults(array) {
  let uniqueSearchResultsArr = [];
  array.forEach(function(item) {
    if (uniqueSearchResultsArr.filter(function(n) {
        return n.id === item.id
      }).length == 0) {
      uniqueSearchResultsArr.push(item);
    }
  });
  return uniqueSearchResultsArr;
}


function prepareRequest(locationLatLng, placeCategory, radius) {  
  let request = {
    location: locationLatLng,
    radius: radius,
    type: placeCategory
  }
  return request;
}

function alphabeticallyOrderResults(array) {
  array.sort(function(a, b) {
    let textA = a.name.toUpperCase();
    let textB = b.name.toUpperCase();
    return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
  });
}

// Starts the chain of functions to make places appear in sidebar.
function showResultsInSidebar(results) {
  
  let resultsHtml;
  if (results.length > 0) {
    resultsHtml = prepareResultsSidebarHtmlFromResults(results);
  } else {
    resultsHtml = `
    <div class="results-initial-margin">
                <br>
                <i class="material-icons">mood_bad</i>
                <p>Sorry, no results found!</p>
                <br>
              </div>
              <hr>`
  }
  loadResultsHtmlInSidebar(resultsHtml);
  revealResultsSidebar();
}

// Reveals sidebar
function revealResultsSidebar() {
  
  $('.results').show();
  unhideResultsAndDisplayTheHideButton();  
}

// Allows manual recenter of map
function panMap(x, y) {
  map.panBy(x, y);
}

// Creates dynamic html for list of locations in sidebar.
function prepareResultsSidebarHtmlFromResults(results) {
  
  let attractionName, attractionLocation, attractionPhoto, attractionId;
  let html = `<div class="results-initial-margin">
                <p>Results on the heatmap:</p>
              </div>
              <hr>`;
  for (let attraction in results) {
    let thisAttraction = results[attraction];
    attractionName = thisAttraction.name;
    attractionLocation = thisAttraction.vicinity;
    attractionPhoto = makeAttractionPhotoHtml(thisAttraction);
    attractionId = thisAttraction.id;
    html +=
      `<section class="attraction-individual-area" attractionid="${attractionId}">
              <img class="attraction-image" src="${attractionPhoto}" alt="${attractionName}">
              <h3>${attractionName}</h3>
              <p>${attractionLocation}</p>
            </section>
            <hr>
            `
  }
  return html;
}

// Gets photo for each place section in the sidebar
function makeAttractionPhotoHtml(thisAttraction) {
  if (thisAttraction.photos) {
    return thisAttraction.photos[0].getUrl({
      maxWidth: 150
    });
  } else {
    // if no image is available: 
    return 'https://upload.wikimedia.org/wikipedia/commons/a/ac/No_image_available.svg';
  }
}

// Load the html
function loadResultsHtmlInSidebar(resultsHtml) {
  $('.results-area').html(resultsHtml);
}

// Highlights place on map when user clicks a place item in the sidebar.
function listenForUserClickOnResults() {
  
  $('.results-area').on('click', '.attraction-individual-area', function(event) {
    let thisAttractionId, thisAttractionObject, thisAttractionLatLngObject;
    thisAttractionId = $(event.target).closest('section').attr('attractionid');

    // The global variable placesJson contains the data for places displayed on the map
    thisAttractionObject = uniqueSearchResultsArr.filter(function(obj) {
      return obj.id == thisAttractionId;
    })[0];

    // Remove any markers already on map
    if (marker) {
      marker.setMap(null)
    }

    // Center map on place clicked
    thisAttractionLatLngObject = makeLatLngObject(thisAttractionObject);
    centerMapOnLocation(thisAttractionLatLngObject);

    let name = thisAttractionObject.name;
    // Put marker on place!
    marker = new google.maps.Marker({
      position: thisAttractionLatLngObject,
      map: map,
      title: name 
    });
  });
}

// Handles clicks to button that shows/hides sidepane
function listenForToggleShowResultsButtonClick() {
  $('.js-toggle-show-results-button').on('click', function(event) {
    event.preventDefault();
    if ($('.js-toggle-show-results-button').hasClass('hide-button')) {
      hideResultsAndDisplayTheShowButton();
    } else {
      unhideResultsAndDisplayTheHideButton();
    }
  })
}
// see above 
function hideResultsAndDisplayTheShowButton() {
  
  $('.js-toggle-show-results-button').removeClass('hide-button')
    .addClass('show-button')
    .attr('title', 'Show the sidebar')
    .children(".material-icons").html('keyboard_arrow_right');
  $('.results-area').hide();
  $('.results-background').hide()
}
// see above 
function unhideResultsAndDisplayTheHideButton() {
  
  $('.js-toggle-show-results-button').removeClass('show-button')
    .addClass('hide-button')
    .attr('title', 'Hide the sidebar')
    .children(".material-icons").html('keyboard_arrow_left');
  $('.results-area').show();
  $('.results-background').show()
}

// Creates lat/lngs object in the format needed for Google's heatmap generator.
function makeLatLngsFromPlacesJson(json) {
  let heatmapLatLngsArr = [], latLngObject;
  for (let item in json) {
    latLngObject = makeLatLngObject(json[item]);
    heatmapLatLngsArr.push(new google.maps.LatLng(latLngObject.lat, latLngObject.lng));
  }
  return heatmapLatLngsArr;
}

// Returns lat/lng in format that can be used with Google Maps.
// There are several ways that Google's APIs present lat/lng data. 
function makeLatLngObject(source) {
  let latLngObject;
  if (source.geometry && typeof source.geometry.location.lat == 'function') {
    latLngObject = {
      lat: source.geometry.location.lat(),
      lng: source.geometry.location.lng()
    }
  } else if (source.geometry) {
    latLngObject = {
      lat: source.geometry.location.lat,
      lng: source.geometry.location.lng
    }
  } else if (source.coords) {
    latLngObject = {
      lat: source.coords.latitude,
      lng: source.coords.longitude
    }
  } else if (typeof source.lat == 'function') {
    latLngObject = {
      lat: source.lat(),
      lng: source.lng()
    }
  } else {
    latLngObject = {
      lat: source.lat,
      lng: source.lng
    }
  } 
  return latLngObject
}

// Final function in the chain started by initiateSearchFunctions()...
// Makes heatmap!
function createHeatmap(heatmapLatLngsArr) {
  
  if (!heatmap) {
    // For the first layer - makes our heatmap layer.
    heatmap = new google.maps.visualization.HeatmapLayer({
      data: heatmapLatLngsArr,
      map: map,
      radius: 70,
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

// Called when Google API finishes loading.  Kickstarts the page with
// initial map/heatmap and calls prepareAutocomplete().  
function initMap() {
  // Create Google Map centered on defaultLatLng. 
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 15,
    center: defaultLatLng,
    mapTypeControlOptions: {
      style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
      position: google.maps.ControlPosition.BOTTOM_CENTER,
    }
  });
  // To demonstrate utility to user on pageload:
  performInitialHeatmapSearch();
  // Add autocomplete functionality to searchbar.
  prepareAutocomplete();
  // Add 'search around a clicked spot on the map' functionality 
  prepareSearchOnClickToMap();
}

// Either perform initial search on user's location, or use
// a central London to present an example search.
function performInitialHeatmapSearch() {
  
  navigator.geolocation.getCurrentPosition(function(userPosition) {
    userLocationLatLngObject = makeLatLngObject(userPosition);
    showUserLocation();
    centerOnUserLocation(userPosition, userLocationLatLngObject);
  }, function(error) {
    // Displays an example search to user only if:
    // 1. The user's location isn't available
    // 2. The user has not already searched for a heatmap themselves
    if (!heatmap) {
      centerMapOnLocation(defaultLatLng);
      makeNewPlacesRequest(defaultLatLng);
    }
  });
}

// Adds autocomplete functionality to search bar.
// Called when Google Maps API is finished loading (see initMap, below).
function prepareAutocomplete() {
  
  let input = document.getElementById('js-search-box')
  let autocomplete = new google.maps.places.Autocomplete(input);
  // Bind the map's bounds (viewport) property to the autocomplete object,
  // so that the autocomplete requests use the current map bounds for the
  // bounds option in the request.
  autocomplete.bindTo('bounds', map);
  autocomplete.addListener('place_changed', function() {
    // In case the 'no such location' error message is currently displayed
    removeNoSuchLocationErrorMessage();
  });
}

function prepareSearchOnClickToMap() {
  google.maps.event.addListener(map, 'click', function(event) {
    let clickedLatLngObject = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    }
    makeNewPlacesRequest(clickedLatLngObject);
  });
}

// Centers viewport to user's position. 
function centerOnUserLocation(userPosition) {
  
  userLocationLatLngObject = new google.maps.LatLng(userPosition.coords.latitude, userPosition.coords.longitude);
  centerMapOnLocation(userLocationLatLngObject);
  makeNewPlacesRequest(userLocationLatLngObject);
}

// Marks user location with circle and temporary label.
function showUserLocation() {
  
  
  youAreHereLabel = new google.maps.InfoWindow;
  let radius = getRadiusForPlacesRequest() / 45;

  // Shows label pointing to user location:
  youAreHereLabel.setPosition(userLocationLatLngObject);
  youAreHereLabel.setContent("You!");
  youAreHereLabel.open(map);

  let backgroundShroud = document.getElementById('js-background-shroud');
  if (backgroundShroud.getAttribute('style') == 'display: none;') {
    // Hides the label after 2 seconds:
    hideYouAreHereLabel()
  }
  // Shows circle on user location:
  new google.maps.Circle({
    strokeColor: '#F48024',
    strokeOpacity: 1,
    strokeWeight: 2,
    fillColor: '#1179F4',
    fillOpacity: 0.35,
    map: map,
    center: userLocationLatLngObject,
    radius: radius
  });
}

// Allows help to display/hide when in/out focus
function listenForHelpFocus() {
  // for mouse users
  $('.help').on('mouseenter', function() {
    displayHelp();
  }).on('mouseleave', function() {
    hideHelp();
  });

  // for keyboard users
  $('.help').focus(function() {
    displayHelp();
  }).focusout(function() {
    hideHelp()
  });
}

function displayHelp() {
  let html = `
  <h3>Help</h3>
  <p>Find the best places to explore. To search, just click on
    the map or type a location into the search bar.  Be sure to
    pick your interests from the drop-down menu.  
  </p>
  `
  $('.help-text').html(html).show();
}

function hideHelp() {
  $('.help-text').html('').hide();
}

// Checks need to recent map on webpage for UX
function checkNeedForRecentering() {
  
  let resultsArea = document.getElementById('js-results');
  //if (!resultsArea.hasAttribute('hidden') && $(window).width() > 750) {
  if ($(window).width() > 750) {
    let visibleMapWidth = $(window).width() - 350;
    let visibleMapHeight = $(window).height() - 120;
    panMap(-visibleMapWidth / 7, -visibleMapHeight / 6);
  } 
}

// Presents error to user when location isn't in database.
function displayNoSuchLocationErrorMessage() {
  let html =
    `<i class="js-no-such-location-error-message-close 
             no-such-location-error-message-close 
             material-icons">close</i>
  <i class="material-icons">mood_bad</i>
  <br>Sorry, that location isn't available... Why not try another? 
  `;
  $('.js-no-such-location-error-message').show().html(html);
}

// Listener for user clicking 'close' to remove error message.
function listenForUserClickOnCloseNoSuchLocationErrorMessage() {
  $('.js-no-such-location-error-message')
    .on('click', '.js-no-such-location-error-message-close', function(event) {
      removeNoSuchLocationErrorMessage();
    });
}

// When the user submits a valid location or clicks 'close'.
function removeNoSuchLocationErrorMessage() {
  $('.js-no-such-location-error-message').html('').hide();
}

// Centers map on new location.
function goToLocation(locationObject) {
  // In case the 'no such location' error message is currently displayed
  removeNoSuchLocationErrorMessage();
  if (locationObject.geometry.viewport) {
    // If available, consider the location's size to help set zoom level...
    setMapViewportUsingBounds(locationObject)
  } else {
    // ... Else, just center viewport on the location. 
    locationLatLng = makeLatLngObject(locationObject)
    centerMapOnLocation(locationLatLng);
  }
}

// Uses location's bounds to set appropriate zoom level.
function setMapViewportUsingBounds(locationObject) {
  let bounds = new google.maps.LatLngBounds();
  // Use location's northwest and southeast extremes to set zoom: 
  bounds.extend(locationObject.geometry.viewport.northeast);
  bounds.extend(locationObject.geometry.viewport.southwest);
  map.fitBounds(bounds);
}

// Usually called on the results of makeLatLngObject (see above).
function centerMapOnLocation(latLngObject) {
  let resultsArea = document.getElementById('js-results')
  if (latLngObject.lat) {
    map.setCenter(latLngObject);
  }
}


$('.js-search-box').focus();
startListeningForUserInput();