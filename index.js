'use strict';

let map, heatmapLatLngsArr, heatmap, userPosition, userLocationLatLngObject, marker, youAreHereLabel, aggregateSearchResultsArr = [],
  uniqueSearchResultsArr = [];

// Initial lat/lng for pageload (if app can't geolocate user)
let defaultLatLng = {
  lat: 51.5032,
  lng: -0.1123
};

// Initiates listeners - called on pageload
function startListeningForUserInput() {
  console.log('startListeningForUserInput');
  listenForStartClick();
  listenForGoClick();
  listenForHelpFocus()
  listenForReturnOnSearch();
  listenForToggleShowResultsButtonClick();
  listenForUserClickOnResults();
  listenForUserClickOnCloseNoSuchLocationErrorMessage();
}

function listenForStartClick() {
  console.log('listenForStartClick');
  $('.start-button').on('click', function(event) {
    revealApp();
  });
}

// Removes the landing page and shows the app
function revealApp() {
  console.log('revealApp');
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

// Takes user input (location and place type) and
// calls handleGoClick.
function listenForGoClick() {
  console.log('listenForGoClick');
  $('.js-go-button').on('click', function(event) {
    event.preventDefault();
    // Will only act if user has typed into the search box.
    initiateSearchFunctions();
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

// 
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

// As above, but listens for user pressing return key
// on a location search.
function listenForReturnOnSearch() {
  console.log('listenForReturnOnSearch');
  $('.js-search-box').keydown(function(event) {
    if (event.which == 13) {
      event.preventDefault()
      initiateSearchFunctions();
    }
  })
}

// Takes the location search term from the top of the UI 
// and uses it to perform a search request.
function initiateSearchFunctions() {
  console.log('initiateSearchFunctions');
  // Only runs if the inputs are filled out.
  if ($('.js-search-box').val()) {
    let locationString = $('.js-search-box').val();
    handleUserSearchRequest(locationString);
  }
}

// Called when user clicks 'search' or presses 'enter' 
// on search input
function handleUserSearchRequest(locationString) {
  console.log('handleUserSearchRequest');
  let geocodeUrl = makeGeocodeUrl(locationString);
  getAndCheckLocationJson(geocodeUrl);
}

// Makes the Url used in getAndCheckLocationJson().
function makeGeocodeUrl(locationString) {
  console.log('makeGeocodeUrl');
  return `https://maps.googleapis.com/maps/api/geocode/json?key=AIzaSyAwrO9kTCuS6Zimy4p4zCZMa-UUsgJ_7OU&address=${locationString}`;
}

// JSON request immediately followed by error-check.
// (Executing checkProposedLocationIsValid() outside of the getJSON
// request seems to prevent the error checks from working.)
function getAndCheckLocationJson(geocodeUrl) {
  console.log('getAndCheckLocationJson');
  $.getJSON(geocodeUrl, function(json) {
    let locationJson = json;
    checkProposedLocationIsValid(locationJson);
  })

}
// Checks that the location exists on Google's API.
// If so, continues the chain of functions.
function checkProposedLocationIsValid(locationJson) {
  console.log('checkProposedLocationIsValid');
  if (locationJson.status == "ZERO_RESULTS") {
    // Show an error if it isn't on Google's API... 
    console.log('Error - proposed location is not found.')
    displayNoSuchLocationErrorMessage();
  } else {
    let locationObject = locationJson.results[0];
    // Center the map
    goToLocation(locationObject);
    checkNeedForRecentering();
    //
    makeNewPlacesRequest(locationObject);
  }
}

// Presents error to user when location isn't in database.
function displayNoSuchLocationErrorMessage() {
  console.log('displayNoSuchLocationErrorMessage');
  let noSuchLocationErrorMessage =
    `<i class="js-no-such-location-error-message-close 
             no-such-location-error-message-close 
             material-icons">close</i>
  <i class="material-icons">mood_bad</i>
  <br>Sorry, that location isn't available... Why not try another? 
  `;
  $('.js-no-such-location-error-message').html(noSuchLocationErrorMessage).removeAttr('hidden');
}

// Listener for user clicking 'close' to remove error message.
function listenForUserClickOnCloseNoSuchLocationErrorMessage() {
  console.log('listenForUserClickOnCloseNoSuchLocationErrorMessage');
  $('.js-no-such-location-error-message')
    .on('click', '.js-no-such-location-error-message-close', function(event) {
      removeNoSuchLocationErrorMessage();
    });
}



// When the user submits a valid location or clicks 'close'.
function removeNoSuchLocationErrorMessage() {
  console.log('removeNoSuchLocationErrorMessage');
  $('.js-no-such-location-error-message').html('').hide();
}

// Centers map on new location.
function goToLocation(locationObject) {
  console.log('goToLocation');
  // In case the 'no such location' error message is currently displayed
  removeNoSuchLocationErrorMessage();
  if (locationObject.geometry.viewport) {
    // If available, consider the location's size to help set zoom level...
    setMapViewportUsingBounds(locationObject)
  } else if (locationObject) {
    // ... Else, just center viewport on the location. 
    locationLatLng = makeLatLngObject(locationObject)
    centerMapOnLocation(locationLatLng);
  } else {
    console.log('Error - undefined object was passed to goToLocation()')
  }
}

// Uses location's bounds to set appropriate zoom level.
function setMapViewportUsingBounds(locationObject) {
  console.log('setMapViewportUsingBounds');
  let bounds = new google.maps.LatLngBounds();
  // Use location's northwest and southeast extremes to set zoom: 
  bounds.extend(locationObject.geometry.viewport.northeast);
  bounds.extend(locationObject.geometry.viewport.southwest);
  map.fitBounds(bounds);
}

// Returns lat/lng in format that can be used with Google Maps.
// There are several ways that Google's APIs present lat/lng data.
// This function handles them or displays an error message. 
function makeLatLngObject(source) {
  console.log('makeLatLngObject');
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
  } else if (source.lat) {
    latLngObject = {
      lat: source.lat,
      lng: source.lng
    }
  } else {
    console.log('Error - unrecognised lat/lng source type');
  }
  return latLngObject
}

// Usually called on the results of makeLatLngObject (see above).
function centerMapOnLocation(latLngObject) {
  console.log('centerOnLocation');
  let resultsArea = document.getElementById('js-results')
  map.setCenter(latLngObject);
}

// Pulls together data for request, then makes request.
function makeNewPlacesRequest(locationObject) {
  console.log('makeNewPlacesRequest');

  // Pulling together request data: 
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
    // for individual categories - eg 'art_galleries'
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

// Requests places and makes a heatmapArr for createHeatmap.
// Might change to 'handleRequestForPlacesJson' and use it to direct to different functions for
// collections (culture) and individual categories (church)
function requestPlacesJson(locationLatLng, placeCategory, radius, collection) {
  console.log('requestPlacesJson');
  let service = new google.maps.places.PlacesService(map);

  // For collections of category - eg 'culture' etc
  if (collection) {
    for (let subtype in placeCategory) {
      // define request for each subtype
      let request = prepareRequest(locationLatLng, placeCategory[subtype], radius);
      // Make request to Places library!
      service.nearbySearch(request, function(results) {

        if (results.length > 0) {
          combineResults(results, aggregateSearchResultsArr);
        }
      });

    }

    // Wait for json request to be fulfilled...
    setTimeout(function() {

      // Put unique results in uniqueSearchResultsArr
      uniqueSearchResultsArr = filterResults(aggregateSearchResultsArr);
      alphabeticallyOrderResults(uniqueSearchResultsArr)
      showResultsInSidebar(uniqueSearchResultsArr);
      // Build the heatmap with uniqueSearchResultsArr
      heatmapLatLngsArr = makeLatLngsFromPlacesJson(uniqueSearchResultsArr);
      createHeatmap(heatmapLatLngsArr);
    }, 2000)


    // For individual categories - eg 'art_gallery' etc
  } else {
    let request = {
      location: locationLatLng,
      radius: radius,
      type: placeCategory
    }
    service.nearbySearch(request, function(results) {
      alphabeticallyOrderResults(results)
      showResultsInSidebar(results);
      heatmapLatLngsArr = makeLatLngsFromPlacesJson(results); 
      createHeatmap(heatmapLatLngsArr);
      uniqueSearchResultsArr = results;
    })
  }
}

// Used to aggregate results into aggregateSearchResultsArr
function combineResults(results, arr) {
  console.log('combineResults');
  for (let result in results) {
    arr.push(results[result]);
  }
  return arr;
}

function prepareRequest(locationLatLng, placeCategory, radius) {
  console.log('prepareRequest');
  let request = {
    location: locationLatLng,
    radius: radius,
    type: placeCategory
  }
  return request;
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

function alphabeticallyOrderResults(array) {
  array.sort(function(a, b) {
    let textA = a.name.toUpperCase();
    let textB = b.name.toUpperCase();
    return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
  });
}

// Filters out duplicate objects from an array
function checkMembership(uniqueSearchResultsArr, value) {
  console.log('checkMembership');
  for (let item in uniqueSearchResultsArr) {
    if (uniqueSearchResultsArr[item].id == value) {
      return true;
    }
    return false;
  }
}

// Starts the chain of functions to make places appear in sidebar.
function showResultsInSidebar(results) {
  console.log('showResultsInSidebar');
  let resultsHtml;
  if (results.length > 0) {
    resultsHtml = prepareResultsHtmlFromResults(results);
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
  loadResultsHtml(resultsHtml);
  revealResultsArea();
}

// Reveals sidebar
function revealResultsArea() {
  console.log('revealResultsArea');
  $('.results').show();
  unhideResultsAndDisplayTheHideButton();  
}

// Checks need to recent map on webpage for UX
function checkNeedForRecentering() {
  console.log('checkNeedForRecentering');
  let resultsArea = document.getElementById('js-results');
  console.log($(window).width() > 750);
  //if (!resultsArea.hasAttribute('hidden') && $(window).width() > 750) {
  if ($(window).width() > 750) {
    let visibleMapWidth = $(window).width() - 350;
    let visibleMapHeight = $(window).height() - 120;
    panMap(-visibleMapWidth / 7, -visibleMapHeight / 6);
  } 
}

// Allows manual recenter of map
function panMap(x, y) {
  console.log('panMap');
  map.panBy(x, y);
}

// Creates dynamic html for list of locations in sidebar.
function prepareResultsHtmlFromResults(results) {
  console.log('prepareResultsHtmlFromResults');
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
function loadResultsHtml(resultsHtml) {
  console.log('loadResultsHtml');
  $('.results-area').html(resultsHtml);
}

// Highlights place on map when user clicks a place item in the sidebar.
function listenForUserClickOnResults() {
  console.log('listenForUserClickOnResults');
  $('.results-area').on('click', '.attraction-individual-area', function(event) {
    console.log('clicked on result');
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
      title: name //--------------------------------------------------------------------------------
    });
  });
}

// Handles clicks to button that shows/hides sidepane
function listenForToggleShowResultsButtonClick() {
  console.log('listenForToggleShowResultsButtonClick');
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
  console.log('unhideResultsAndDisplayTheHideButton');
  $('.js-toggle-show-results-button').removeClass('hide-button')
    .addClass('show-button')
    .attr('title', 'Show the sidebar')
    .children(".material-icons").html('keyboard_arrow_right');
  $('.results-area').hide();
  $('.results-background').hide()
}
// see above 
function unhideResultsAndDisplayTheHideButton() {
  console.log('hideResultsAndDisplayTheShowButton');
  $('.js-toggle-show-results-button').removeClass('show-button')
    .addClass('hide-button')
    .attr('title', 'Hide the sidebar')
    .children(".material-icons").html('keyboard_arrow_left');
  $('.results-area').show();
  $('.results-background').show()
}

// creates lat/lngs object in the format accepted by the API.
function makeLatLngsFromPlacesJson(json) {
  console.log('makeLatLngsFromPlacesJson');
  let heatmapLatLngsArr = [],
    latLngObject;
  for (let item in json) {
    latLngObject = makeLatLngObject(json[item]);
    heatmapLatLngsArr.push(new google.maps.LatLng(latLngObject.lat, latLngObject.lng));
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
  console.log('initMap');
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
  console.log('performInitialHeatmapSearch');
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
  console.log('prepareAutocomplete');
  let input = document.getElementById('js-search-box')
  let autocomplete = new google.maps.places.Autocomplete(input);
  // Bind the map's bounds (viewport) property to the autocomplete object,
  // so that the autocomplete requests use the current map bounds for the
  // bounds option in the request.
  autocomplete.bindTo('bounds', map);
  autocomplete.addListener('place_changed', function() {

    // In case the 'no such location' error message is currently displayed
    removeNoSuchLocationErrorMessage();
    let place = autocomplete.getPlace();
    let placeLatLngObj = makeLatLngObject(place);
    if (place.geometry.viewport) {
      console.log('centering with viewport');
      // uses viewport coords (if place object has them) to bound map.
      map.fitBounds(place.geometry.viewport);
    } else {
      console.log('centering with central point');
      // else just center on the location
      centerMapOnLocation(placeLatLngObj);
    }
    makeNewPlacesRequest(placeLatLngObj);
  });
}

function prepareSearchOnClickToMap() {
  google.maps.event.addListener(map, 'click', function(event) {
    console.log('handling map click...');
    let clickedLatLngObject = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng()
    }
    makeNewPlacesRequest(clickedLatLngObject);
  });
}

// Centers viewport to user's position. 
function centerOnUserLocation(userPosition) {
  console.log('centerOnUserLocation');
  userLocationLatLngObject = new google.maps.LatLng(userPosition.coords.latitude, userPosition.coords.longitude);
  centerMapOnLocation(userLocationLatLngObject);
  makeNewPlacesRequest(userLocationLatLngObject);
}

// Marks user location with circle and temporary label.
function showUserLocation() {
  console.log('showUserLocation');
  console.log('showLocation');
  youAreHereLabel = new google.maps.InfoWindow;
  let radius = getRadiusForPlacesRequest() / 45;

  // Shows label pointing to user location:
  youAreHereLabel.setPosition(userLocationLatLngObject);
  youAreHereLabel.setContent("You!");
  youAreHereLabel.open(map);

  let backgroundShroud = document.getElementById('js-background-shroud');
  if (backgroundShroud.hasAttribute('hidden')) {
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



$('.js-search-box').focus();
startListeningForUserInput();



// Additional Google Maps heatmap controls available online:
// https://developers.google.com/maps/documentation/javascript/examples/layer-heatmap