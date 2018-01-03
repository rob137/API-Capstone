# Warmer - find the best areas to explore, fast, using heatmap search.

First capstone project on Thinkful's Flex Web Development Course. Can be viewed <a href="https://rob137.github.io/Warmer/">here</a>. 

<img src="https://preview.ibb.co/givhWb/london_demo.png" alt="Screenshot of app">

Highlights clusters of attractions like restaurants, museums, bars etc.  Uses the Google Maps API and libraries (Places, Geometry and Autocomplete). 

##Use Case 

Why is this app useful? Allows users to quickly identify hubs in unfamiliar cities, helping them decide which general area to explore on foot. For flâneurs: "someone who, unlike a tourist, makes a decision at every step to revise his schedule, so he can imbibe things based on new information. The flâneur is not a prisoner of a plan." -- <a href="https://mobile.twitter.com/nntaleb">@NNTaleb</a>

##UX

<a href="https://gist.github.com/rob137/a4c055ea43a12b5627882e612af1a8a7">Initial Wireframes</a>

The app was designed to work on mobile as well as tablet and desktop from the outset. 

After a landing page giving a brief summary of the app, a searchpage appears with a map. Users can either enter an address to a search bar or click-to-search on the map.  On hitting 'search', the user is presented with heat 'blobs' on the map, showing where attractions are clustered together.  Attraction search categories ('Cultural', 'Nightlife') can be selected from a dropdown menu. The user is also presented with a sidepane which allows them to locate individual results on the map.

Instructions are available from a help icon at the top of the page.  When the user types an unrecognised location or makes a search that yields no results, they are presented with an error message and asked to try another search.

##Technical

Built using HTML5, CSS3 and JavaScript/JQuery.  Driven by event listeners for user input.  
The app is fully responsive, adapting for mobile, tablet and desktop viewports.  
The search radius is set dynamically, based on either the viewport size or Google's recommended (zoom) settings for particular locations.
For broad categories of attractions (e.g. 'cultural'), the app submits separate requests to the Places library for each subtype ('museum', 'art_gallery', etc).  Duplicates are then removed and the results are ordered alphabetically and displayed in a sidepane.  The map automatically re-centers to allow for space taken up by the sidepane.  The user can click on each result in the sidepane to see them highlighted on the map. 
Geolocation is used for an initial search on pageload to demonstrate search functionality.  If unable to geolocate to user's device, the app will provide a default search in London.  