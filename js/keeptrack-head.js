// Debug Mode
var db = {}; //Global Debug Manager
try {
  db = JSON.parse(localStorage.getItem("db"));
  if (db == null) reloadDb();
  if (typeof db.enabled == 'undefined') reloadDb();
} catch (e) {
  db = {};
  db.enabled = false;
  db.verbose = false;
  localStorage.setItem("db", JSON.stringify(db));
}
db.init = (function (){
  db.log = function (message, isVerbose) {
    // Don't Log Verbose Stuff Normally
    if (isVerbose && !db.verbose) return;

    // If Logging is Enabled - Log It
    if(db.enabled) {
      console.log(message);
    }
  };
  db.on = function () {
    db.enabled = true;
    console.log('db is now on!');
    localStorage.setItem("db", JSON.stringify(db));
  };
  db.off = function () {
    db.enabled = false;
    console.log('db is now off!');
    localStorage.setItem("db", JSON.stringify(db));
  };
})();

// Settings Manager Setup
(function () {
  var settingsManager = {};

  //  Version Control
  settingsManager.versionNumber = '1.16.2';
  settingsManager.versionDate = 'August 5, 2020';
  if (window.location.host == 'keeptrack.space') {
    settingsManager.installDirectory = '/';
  }
  else if (window.location.host == 'thkruz.github.io') {
    settingsManager.installDirectory = '/keeptrack.space/';
  }
  else {
    settingsManager.installDirectory = './';
  }

  // settingsManager.screenshotMode = true;

  // let pathArray = window.location.pathname.split('/');
  // for (var i = 0; i < pathArray.length - 1; i++) {
  //   if (pathArray[i] != '/') {
  //     settingsManager.installDirectory += pathArray[i] + '\/';
  //   } else {
  //     settingsManager.installDirectory = '/';
  //   }
  // }

  settingsManager.lowPerf = false;
  settingsManager.maxFieldOfViewMarkers = 105000;
  settingsManager.maxMissiles = 500;
  settingsManager.maxAnalystSats = 256;

  settingsManager.nasaImages = false;
  settingsManager.blueImages = false;
  settingsManager.lowresImages = false;
  settingsManager.hiresImages = false;
  settingsManager.hiresNoCloudsImages = false;
  settingsManager.vectorImages = false;

  if (window.location.hostname === 'keeptrack.space' ||
      // window.location.hostname === 'localhost' ||
      window.location.hostname === 'thkruz.github.io') {
    settingsManager.offline = false;
  } else {
    settingsManager.offline = true;
    settingsManager.unofficialSite = true;
  }

  let lastMap = localStorage.getItem("lastMap");
  switch (lastMap) {
    case 'blue':
      settingsManager.blueImages = true;
      break;
    case 'nasa':
      settingsManager.nasaImages = true;
      break;
    case 'low':
      settingsManager.lowresImages = true;
      break;
    case 'trusat':
      settingsManager.trusatImages = true;
      break;
    case 'high':
      settingsManager.hiresImages = true;
      break;
    case 'high-nc':
      settingsManager.hiresNoCloudsImages = true;
      break;
    case 'vec':
      settingsManager.vectorImages = true;
      break;
    default:
      settingsManager.lowresImages = true;
      break;
  }

  settingsManager.minimumDrawDt = 0.1; // 20 FPS // 60 FPS = 0.01667;

  (function initParseFromGETVariables () {
    // This is an initial parse of the GET variables
    // A satSet focused one happens later.
    let queryStr = window.location.search.substring(1);
    let params = queryStr.split('&');
    for (let i = 0; i < params.length; i++) {
      let key = params[i].split('=')[0];
      let val = params[i].split('=')[1];
      switch (key) {
        case 'lowperf':
          settingsManager.lowPerf = true;
          settingsManager.maxFieldOfViewMarkers = 1;
          break;
        case 'hires':
          settingsManager.hiresImages = true;
          settingsManager.minimumDrawDt = 0.01667;
          break;
        case 'vec':
          settingsManager.vectorImages = true;
          break;
        case 'retro':
          settingsManager.retro = true;
          settingsManager.tleSource = 'tle/retro.json';
          break;
        case 'offline':
          settingsManager.offline = true;
          break;
        case 'debris':
          settingsManager.tleSource = 'tle/TLEdebris.json';
          break;
        case 'mw':
          settingsManager.tleSource = 'tle/mw.json';
          break;
        case 'trusat':
          db.log('TruSat Overlay Mode Initializing');
          settingsManager.trusatMode = true;
          settingsManager.trusatImages = true;
          break;
        case 'trusat-only':
          db.log('TruSat Only Mode Initializing');
          settingsManager.trusatMode = true;
          settingsManager.trusatOnly = true;
          settingsManager.trusatImages = true;
          settingsManager.tleSource = 'tle/trusat.json';
          break;
        case 'cpo':
          settingsManager.copyrightOveride = true;
          break;
        case 'logo':
          settingsManager.isShowLogo = true;
          break;
        case 'noPropRate':
          settingsManager.isAlwaysHidePropRate = true;
          break;
        }
      }
    })();

  settingsManager.themes = {};
  settingsManager.isThemesNeeded = false;
  settingsManager.themes.currentTheme = 'Blue';
  settingsManager.themes.retheme = function () {
    if (!settingsManager.isThemesNeeded) return;
    if (settingsManager.themes.currentTheme === 'Blue') settingsManager.themes.blueTheme(true);
    if (settingsManager.themes.currentTheme === 'Red') settingsManager.themes.redTheme(true);
  };
  settingsManager.themes.redTheme = function (isForce) {
    if (settingsManager.retro) return;
    if (settingsManager.themes.currentTheme === 'Red' && !isForce) return;
      document.getElementById('nav-wrapper').classList.remove('light-blue');
      document.getElementById('nav-wrapper').classList.add('red');
      document.getElementById('nav-footer').classList.add('red');
      document.getElementById('nav-footer').classList.add('darken-3');
      $('#bottom-menu').css('background', 'rgb(165, 0, 0)');
      $('.bmenu-item').css('border-right-color', 'orangered');
      $('#menu-info-overlay ').css('border-left-color', 'orangered');
      $('.side-menu').css('background', 'LightCoral');
      $('.side-menu').css('border-color', 'DarkRed');
      $('#sat-infobox').css('background', 'LightCoral');
      $('#sat-infobox').css('border-color', 'DarkRed');
      $('#legend-hover-menu').css('background', 'LightCoral');
      $('#legend-hover-menu').css('border-color', 'DarkRed');
      $('#colorbox').css('border', '10px solid DarkRed');
      // $('#search-results').css('cssText', 'background: LightCoral !important');
      // $('#search-results').css('border-color', 'DarkRed');
      // $('#search-result:hover').css('background', 'DarkRed');
      $('#nav-footer-toggle').css('background', 'DarkRed');
      $('.badge').css('cssText', 'color: DarkRed !important');
      $('.search-hilight').css('color', 'DarkRed');
      $('.btn-ui').css('background-color', 'red');
      settingsManager.themes.currentTheme = 'Red';
    };
  settingsManager.themes.redThemeSearch = function (isForce) {
    if (settingsManager.retro) return;
    if (settingsManager.themes.currentTheme !== 'Red' && !isForce) return;
    $('#search-results').css('background', 'LightCoral');
    $('#search-result:hover').css('background', 'DarkRed');
    $('.search-hilight').css('color', 'DarkRed');
  };
  settingsManager.themes.blueTheme = function (isForce) {
    if (settingsManager.retro) return;
    if (settingsManager.themes.currentTheme === 'Blue' && !isForce) return;
    document.getElementById('nav-wrapper').classList.remove('red');
    document.getElementById('nav-footer').classList.remove('red');
    document.getElementById('nav-footer').classList.remove('darken-3');
    document.getElementById('nav-wrapper').classList.add('light-blue');
    $('#nav-footer').css('background-color', '#0277bd');
    $('#bottom-menu').css('background', 'rgb(0,105,165)');
    $('.bmenu-item').css('border-right-color', 'steelblue');
    $('.badge').css('color', '#00568a !important');
    $('#menu-info-overlay ').css('border-left-color', 'steelblue');
    $('.side-menu').css('background', '#0a97d6');
    $('.side-menu').css('border-color', '#0277bd');
    // $('#search-results').css('cssText', 'background: #0a97d6 !important');
    // $('#search-results:hover').css('background', '#0277bd');
    // $('#search-results').css('border-color', '#0277bd');
    $('#legend-hover-menu').css('background', '#0a97d6');
    $('#legend-hover-menu').css('border-color', '#0277bd');
    $('#colorbox').css('border', '10px solid #0277bd');
    $('#sat-infobox').css('background', '#0a97d6');
    $('#sat-infobox').css('border-color', '#0277bd');
    $('#nav-footer-toggle').css('background', '#0277bd');
    $('.search-hilight').css('color', '#01579b');
    $('.btn-ui').css('background-color', '#0091ea');
    settingsManager.themes.currentTheme = 'Blue';
  };

  settingsManager.shadersReady = false;
  settingsManager.cruncherReady = false;

  settingsManager.lkVerify = Date.now();

  settingsManager.redTheme = false;

  settingsManager.limitSats = '';
  settingsManager.searchLimit = 400;

  settingsManager.canvasManager = {};
  settingsManager.canvasManager.satPointMinSize = 4.0; // MUST BE A FLOAT
  settingsManager.canvasManager.satPointMaxSize = 60.0; // MUST BE A FLOAT

  settingsManager.canvasManager.defaultCameraDistanceFromEarth = 44105;

  settingsManager.fieldOfView = 0.6;
  settingsManager.fieldOfViewMin = 0.04; // 4 Degrees (I think)
  settingsManager.fieldOfViewMax = 1.2; // 120 Degrees (I think)

  settingsManager.geolocation = {};
  settingsManager.geolocationUsed = false;

  settingsManager.mapWidth = 800;
  settingsManager.mapHeight = 600;

  settingsManager.hoverColor = [0.1, 1.0, 0.0, 1.0]; // Green
  settingsManager.selectedColor = [1.0, 0.0, 0.0, 1.0]; // Red

  settingsManager.minimumSearchCharacters = 2; // Searches after 3 characters typed

  settingsManager.currentLegend = 'default';

  settingsManager.autoRotateSpeed = 0.02;

  settingsManager.nextNPassesCount = 5;

  settingsManager.timeMachineDelay = 3000;

  settingsManager.socratesOnSatCruncher = null;

  settingsManager.vertShadersSize = 12;
  settingsManager.isEditTime = false;
  settingsManager.isPropRateChange = false;
  settingsManager.isOnlyFOVChecked = false;
  settingsManager.isBottomMenuOpen = false;
  settingsManager.isMapMenuOpen = false;
  settingsManager.isForceColorScheme = false;

  settingsManager.isDemoModeOn = false;
  settingsManager.demoModeInterval = 3000; // in ms (3 second default)
  settingsManager.isSatLabelModeOn = true;
  settingsManager.satLabelInterval = 100; //  in ms (0.5 second default)

  settingsManager.isSatOverflyModeOn = false;
  settingsManager.isFOVBubbleModeOn = false;

  settingsManager.mobileMaxLabels = 100;
  settingsManager.desktopMaxLabels = 20000;
  settingsManager.maxLabels = 20000;

  settingsManager.queuedScreenshot = false;

  settingsManager.isAlwaysHidePropRate = false;

  settingsManager.isMapUpdateOverride = false;
  settingsManager.lastMapUpdateTime = 0;

  settingsManager.cameraMovementSpeed = 0.003;
  settingsManager.cameraMovementSpeedMin = 0.005;

  settingsManager.gpsElevationMask = 15;

  settingsManager.uiManager = {};
  settingsManager.uiManager.keyManager = {};
  settingsManager.uiManager.keyManager.fpsForwardSpeed = 3;
  settingsManager.uiManager.keyManager.fpsSideSpeed = 3;
  settingsManager.uiManager.keyManager.fpsVertSpeed = 3;
  settingsManager.fpsPitchRate = 0.02;
  settingsManager.uiManager.keyManager.fpsYawRate = 0.02;
  settingsManager.uiManager.keyManager.fpsRotateRate = 0.02;

  settingsManager.daysUntilObjectLost = 60;

  settingsManager.camDistBuffer = 2000;

  // /////////////////
  // Mobile Settings
  // /////////////////
  settingsManager.desktopMinimumWidth = 1300;
  settingsManager.isMobileModeEnabled = false;
  if (window.innerWidth <= settingsManager.desktopMinimumWidth) {
    settingsManager.isMobileModeEnabled = true;
    settingsManager.camDistBuffer = 3500;
    // settingsManager.cameraMovementSpeed = 0.0001;
    // settingsManager.cameraMovementSpeedMin = 0.0001;
  }
  settingsManager.isDisableSatHoverBox = false;

settingsManager.satShader = {};
settingsManager.satShader.largeObjectMinZoom = 0.37;
settingsManager.satShader.largeObjectMaxZoom = 0.58;
settingsManager.satShader.minSize = 10.0;
settingsManager.satShader.maxSize = 50.0;
settingsManager.satShader.maxAllowedSize = 100.0;

  // /////////////////
  // Color Settings
  // /////////////////
  settingsManager.currentColorScheme = null;

  settingsManager.reColorMinimumTime = 1000;
  settingsManager.colors = {};
  settingsManager.colors = JSON.parse(localStorage.getItem("settingsManager-colors"));
  if (settingsManager.colors == null ||
      settingsManager.colors.version !== '1.0.3' ||
      settingsManager.unofficialSite) {
    settingsManager.colors = {};
    settingsManager.colors.version = '1.0.3';
    settingsManager.colors.facility = [0.64, 0.0, 0.64, 1.0];
    settingsManager.colors.starHi = [1.0, 1.0, 1.0, 1.0];
    settingsManager.colors.starMed = [1.0, 1.0, 1.0, 0.35];
    settingsManager.colors.starLow = [1.0, 1.0, 1.0, 0.15];
    settingsManager.colors.sensor = [1.0, 0.0, 0.0, 1.0];
    settingsManager.colors.marker = [[0.2, 1.0, 1.0, 1.0],
                                     [1.0, 0.2, 1.0, 1.0],
                                     [1.0, 1.0, 0.2, 1.0],
                                     [0.2, 0.2, 1.0, 1.0],
                                     [0.2, 1.0, 0.2, 1.0],
                                     [1.0, 0.2, 0.2, 1.0],
                                     [0.5, 0.6, 1.0, 1.0],
                                     [0.6, 0.5, 1.0, 1.0],
                                     [1.0, 0.6, 0.5, 1.0],
                                     [1.0, 1.0, 1.0, 1.0],
                                     [0.2, 1.0, 1.0, 1.0],
                                     [1.0, 0.2, 1.0, 1.0],
                                     [1.0, 1.0, 0.2, 1.0],
                                     [0.2, 0.2, 1.0, 1.0],
                                     [0.2, 1.0, 0.2, 1.0],
                                     [1.0, 0.2, 0.2, 1.0],
                                     [0.5, 0.6, 1.0, 1.0],
                                     [0.6, 0.5, 1.0, 1.0],];
    settingsManager.colors.deselected = [1.0, 1.0, 1.0, 0];
    settingsManager.colors.inview = [0.85, 0.5, 0.0, 1.0];
    settingsManager.colors.inviewAlt = [0.2, 0.4, 1.0, 1];
    settingsManager.colors.payload = [0.2, 1.0, 0.0, 0.5];
    settingsManager.colors.rocketBody = [0.2, 0.4, 1.0, 1];
    if (settingsManager.trusatOnly) {
      settingsManager.colors.debris = [0.9, 0.9, 0.9, 1];
    } else {
      settingsManager.colors.debris = [0.5, 0.5, 0.5, 1];
    }
    settingsManager.colors.unknown = [0.5, 0.5, 0.5, 0.85];
    settingsManager.colors.trusat = [1.0, 0.0, 0.6, 1.0];
    settingsManager.colors.analyst = [1.0, 1.0, 1.0, 0.8];
    settingsManager.colors.missile = [1.0, 1.0, 0.0, 1.0];
    settingsManager.colors.missileInview = [1.0, 0.0, 0.0, 1.0];
    settingsManager.colors.transparent = [1.0, 1.0, 1.0, 0.1];
    settingsManager.colors.satHi = [1.0, 1.0, 1.0, 1.0];
    settingsManager.colors.satMed = [1.0, 1.0, 1.0, 0.8];
    settingsManager.colors.satLow = [1.0, 1.0, 1.0, 0.6];
    settingsManager.colors.sunlightInview = [0.85, 0.5, 0.0, 1.0];
    settingsManager.colors.penumbral = [1.0, 1.0, 1.0, 0.3];
    settingsManager.colors.umbral = [1.0, 1.0, 1.0, 0.1];
    // DEBUG Colors
    // settingsManager.colors.sunlight = [0.2, 0.4, 1.0, 1];;
    // settingsManager.colors.penumbral = [0.5, 0.5, 0.5, 0.85];
    // settingsManager.colors.umbral = [0.2, 1.0, 0.0, 0.5];
    //
    settingsManager.colors.gradientAmt = 0;
    // Gradients Must be Edited in color-scheme.js
    // settingsManager.colors.apogeeGradient = [1.0 - settingsManager.colors.gradientAmt, settingsManager.colors.gradientAmt, 0.0, 1.0];
    // settingsManager.colors.velGradient = [1.0 - settingsManager.colors.gradientAmt, settingsManager.colors.gradientAmt, 0.0, 1.0];
    settingsManager.colors.satSmall = [0.2, 1.0, 0.0, 0.65];
    settingsManager.colors.rcsSmall = [1.0, 0, 0, 0.6];
    settingsManager.colors.rcsMed = [0.2, 0.4, 1.0, 1];
    settingsManager.colors.rcsLarge = [0, 1.0, 0, 0.6];
    settingsManager.colors.rcsUnknown = [1.0, 1.0, 0, 0.6];
    settingsManager.colors.ageNew = [0, 1.0, 0, 0.9];
    settingsManager.colors.ageMed = [1.0, 1.0, 0.0, 0.9];
    settingsManager.colors.ageOld = [1.0, 0.6, 0, 0.9];
    settingsManager.colors.ageLost = [1.0, 0.0, 0, 0.9];
    settingsManager.colors.lostobjects = [0.2, 1.0, 0.0, 0.65];
    settingsManager.colors.satLEO = [0.2, 1.0, 0.0, 0.65];
    settingsManager.colors.satGEO = [0.2, 1.0, 0.0, 0.65];
    settingsManager.colors.inGroup = [1.0, 0.0, 0.0, 1.0];
    settingsManager.colors.countryPRC = [1.0, 0, 0, 0.6];
    settingsManager.colors.countryUS = [0.2, 0.4, 1.0, 1];
    settingsManager.colors.countryCIS = [1.0, 1.0, 1.0, 1.0];
    settingsManager.colors.countryOther = [0, 1.0, 0, 0.6];
    localStorage.setItem("settingsManager-colors", JSON.stringify(settingsManager.colors));
  }

  // /////////////////
  // Orbit Color Settings
  // /////////////////
  settingsManager.orbitSelectColor = [1.0, 0.0, 0.0, 1.0];
  settingsManager.orbitHoverColor = [1.0, 0.0, 0.0, 1.0];
  // settingsManager.orbitHoverColor = [0.5, 0.5, 1.0, 1.0];
  settingsManager.orbitInViewColor = [1.0, 1.0, 1.0, 0.6]; // WHITE
  // settingsManager.orbitInViewColor = [1.0, 1.0, 0.0, 1.0]; // Applies to Planetarium View
  //settingsManager.orbitGroupColor = [0.3, 0.5, 1.0, 0.4];
  settingsManager.orbitGroupColor = [1.0, 1.0, 0, 0.4];


  window.settingsManager = settingsManager;
})();

// Try to Make Older Versions of Jquery Work
if (typeof $ == 'undefined') {
  if (typeof jQuery !== 'undefined') {
    var $ = jQuery;
  }
}

// Import CSS needed for loading screen
document.write(`<script type="module">
                  import * as THREE from '${settingsManager.installDirectory}js/lib/three.module.js';
                  window.THREE = THREE;
                </script>`);
document.write('<link rel="stylesheet" href="' + settingsManager.installDirectory + 'css/loading-screen.css?v=' + settingsManager.versionNumber + '" type="text/css"\>');
// Import Fonts
document.write('<link rel="stylesheet" href="' + settingsManager.installDirectory + 'css/fonts.css?v=' + settingsManager.versionNumber + '" type="text/css"\>');
// Import Materialize CSS
document.write('<link rel="stylesheet" href="' + settingsManager.installDirectory + 'css/materialize.css?v=' + settingsManager.versionNumber + '" type="text/css"\>');
document.write('<link rel="stylesheet" href="' + settingsManager.installDirectory + 'css/materialize-local.css?v=' + settingsManager.versionNumber + '" type="text/css"\>');
// Import Bootstrap Color Picker
document.write('<link rel="stylesheet" href="' + settingsManager.installDirectory + 'js/lib/colorPick.css?v=' + settingsManager.versionNumber + '" type="text/css"\>');
// Import Modules Style Sheets
document.write('<link rel="stylesheet" href="' + settingsManager.installDirectory + 'modules/nextLaunchManager.css?v=' + settingsManager.versionNumber + '" type="text/css"\>');

// Load jquery CSS
document.write('<link rel="stylesheet" href="' + settingsManager.installDirectory + 'css/perfect-scrollbar.min.css?v=' + settingsManager.versionNumber + '" type="text/css"\>');
document.write('<link rel="stylesheet" href="' + settingsManager.installDirectory + 'css/jquery-ui.min.css?v=' + settingsManager.versionNumber + '" type="text/css"\>');
document.write('<link rel="stylesheet" href="' + settingsManager.installDirectory + 'css/jquery-ui-timepicker-addon.css?v=' + settingsManager.versionNumber + '" type="text/css"\>');
