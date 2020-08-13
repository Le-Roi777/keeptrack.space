/* /////////////////////////////////////////////////////////////////////////////

(c) 2016-2020, Theodore Kruczek
(c) 2015-2016, James Yoder

main.js is the primary javascript file for keeptrack.space. It manages all user
interaction with the application.
http://keeptrack.space

Original source code released by James Yoder at https://github.com/jeyoder/ThingsInSpace/
under the MIT License. Please reference http://keeptrack.space/license/thingsinspace.txt

All additions and modifications of original code is Copyright © 2016-2020 by
All additions and modifications of original code is Copyright © 2016-2020 by
Theodore Kruczek. All rights reserved. No part of this web site may be reproduced,
published, distributed, displayed, performed, copied or stored for public or private
use, without written permission of the author.

No part of this code may be modified or changed or exploited in any way used
for derivative works, or offered for sale, or used to construct any kind of database
or mirrored at any other location without the express written permission of the author.

///////////////////////////////////////////////////////////////////////////// */
var timeManager = window.timeManager;
var satCruncher = window.satCruncher;

// Camera Variables
var camYaw = 0;
var camPitch = 0;
var camYawTarget = 0;
var camPitchTarget = 0;
var camSnapMode = false;
var zoomLevel = 0.6;
var zoomTarget = 0.6;
var isZoomIn = false;
var camPitchSpeed = 0;
var camYawSpeed = 0;
var camRotateSpeed = 0;

// Menu Variables
var isEditSatMenuOpen = false;
var isDOPMenuOpen = false;
var isLookanglesMenuOpen = false;
var isLookanglesMultiSiteMenuOpen = false;
var isNewLaunchMenuOpen = false;
var isBreakupMenuOpen = false;
var isMissileMenuOpen = false;
var isPlanetariumView = false;
var isAstronomyView = false;
var isSatView = false;
var isVideoRecording = false;
var isCustomSensorMenuOpen = false;

var pitchRotate;
var yawRotate;

var selectedSat = -1;
var lastSelectedSat = -1;

var drawLineList = [];

var updateHoverDelay = 0;
var updateHoverDelayLimit = 1;

var mouseX = 0;
var mouseY = 0;
var mouseTimeout = null;
var mouseSat = -1;
var isMouseMoving = false;
var dragPoint = [0, 0, 0];
var screenDragPoint = [0, 0];
var dragStartPitch = 0;
var dragStartYaw = 0;
var isDragging = false;
var dragHasMoved = false;

var isPinching = false;
var deltaPinchDistance = 0;
var startPinchDistance = 0;

var satScreenPositionArray = {};
var isShowNextPass = false;

var drawLoopCallback;
(function () {
  // Code Once index.htm is loaded
  $(document).ready(function () {
    // Set Default TLE
    if (typeof settingsManager.tleSource == 'undefined') {
      settingsManager.tleSource = 'tle/TLE.json';
    }
    ColorScheme.init();
    $('#loader-text').text('Drawing Dots in Space...');
    satSet.init(function satSetInitCallBack (satData) {
      groups.init();
      searchBox.init(satData);
      (function _checkIfEarthFinished () {
        if (canvasManager.isReady) return;
        $('#loader-text').text('Coloring Inside the Lines...');
        setTimeout(function () {
          _checkIfEarthFinished();
        }, 250);
      })();
      let isFinalLoadingComplete = false;
      (function _finalLoadingSequence () {
        if (!isFinalLoadingComplete && !canvasManager.isReady &&
            canvasManager.isEarthDayLoaded &&
            canvasManager.isEarthNightLoaded &&
            canvasManager.isSunLoaded &&
            canvasManager.isMoonLoaded) {
          setTimeout(function () {
            _finalLoadingSequence();
          }, 250);
          return;
        }
        if (isFinalLoadingComplete) return;

        satSet.setColorScheme(settingsManager.currentColorScheme, true); // force color recalc
        satSet.onCruncherReady();

        setTimeout(function () {
          (function _watchlistInit () {
            var watchlistJSON = (!settingsManager.unofficialSite) ? localStorage.getItem("watchlistList") : null;
            if (watchlistJSON !== null) {
              var newWatchlist = JSON.parse(watchlistJSON);
              watchlistInViewList = [];
              for (var i = 0; i < newWatchlist.length; i++) {
                var sat = satSet.getSatExtraOnly(satSet.getIdFromObjNum(newWatchlist[i]));
                if (sat !== null) {
                  newWatchlist[i] = sat.id;
                  watchlistInViewList.push(false);
                } else {
                  console.error('Watchlist File Format Incorret');
                  return;
                }
              }
              uiManager.updateWatchlist(newWatchlist, watchlistInViewList);
            }
          })();
          (function _parseGetParameters () {
            // do querystring stuff
            var params = satSet.queryStr.split('&');

            // Do Searches First
            for (let i = 0; i < params.length; i++) {
              let key = params[i].split('=')[0];
              let val = params[i].split('=')[1];
              if (key == 'search') {
                // console.log('preloading search to ' + val);
                // Sensor Selection takes 1.5 seconds to update color Scheme
                // TODO: SensorManager might be the problem here, but this works
                // _doDelayedSearch(val);
                searchBox.doSearch(val);
              }
            }

            // Then Do Other Stuff
            for (let i = 0; i < params.length; i++) {
              let key = params[i].split('=')[0];
              let val = params[i].split('=')[1];
              let urlSatId;
              switch (key) {
                case 'intldes':
                urlSatId = satSet.getIdFromIntlDes(val.toUpperCase());
                if (urlSatId !== null) {
                  selectSat(urlSatId);
                }
                break;
                case 'sat':
                urlSatId = satSet.getIdFromObjNum(val.toUpperCase());
                if (urlSatId !== null) {
                  selectSat(urlSatId);
                }
                break;
                case 'misl':
                var subVal = val.split(',');
                $('#ms-type').val(subVal[0].toString());
                $('#ms-attacker').val(subVal[1].toString());
                // $('#ms-lat-lau').val() * 1;
                // ('#ms-lon-lau').val() * 1;
                $('#ms-target').val(subVal[2].toString());
                // $('#ms-lat').val() * 1;
                // $('#ms-lon').val() * 1;
                $('#missile').trigger("submit");
                break;
                case 'date':
                timeManager.propOffset = Number(val) - Date.now();
                $('#datetime-input-tb').datepicker('setDate', new Date(timeManager.propRealTime + timeManager.propOffset));
                satCruncher.postMessage({
                  typ: 'offset',
                  dat: (timeManager.propOffset).toString() + ' ' + (timeManager.propRate).toString()
                });
                break;
                case 'rate':
                val = Math.min(val, 1000);
                // could run time backwards, but let's not!
                val = Math.max(val, 0.0);
                // console.log('propagating at rate ' + val + ' x real time ');
                timeManager.propRate = Number(val);
                satCruncher.postMessage({
                  typ: 'offset',
                  dat: (timeManager.propOffset).toString() + ' ' + (timeManager.propRate).toString()
                });
                break;
              }
            }
          })();
          setTimeout(function () {
            (function _reloadLastSensor () {
            let currentSensor = JSON.parse(localStorage.getItem("currentSensor"));
            if (currentSensor !== null) {
              try {
                // If there is a staticnum set use that
                if (typeof currentSensor[0] == 'undefined' || currentSensor[0] == null) {
                  sensorManager.setSensor(null, currentSensor[1]);
                } else {
                  // If the sensor is a string, load that collection of sensors
                  if (typeof currentSensor[0].shortName == 'undefined') {
                    sensorManager.setSensor(currentSensor[0], currentSensor[1]);
                  } else {
                    // Seems to be a single sensor without a staticnum, load that
                    sensorManager.setSensor(sensorManager.sensorList[currentSensor[0].shortName], currentSensor[1]);
                  }
                }
              }
              catch (e){
                console.warn('Saved Sensor Information Invalid');
              }
            }
          })();
          }, 1000);

          // NOTE:: This is called right after all the objects load on the screen.
          // Version Info Updated
          $('#version-info').html(settingsManager.versionNumber);
          $('#version-info').tooltip({delay: 50, html: settingsManager.versionDate, position: 'top'});

          $('body').attr('style', 'background:black');
          $('#canvas-holder').attr('style', 'display:block');

          mobile.checkMobileMode();

          if (settingsManager.isMobileModeEnabled) { // Start Button Displayed
            $('#mobile-start-button').show();
            $('#spinner').hide();
            $('#loader-text').html('');
          } else { // Loading Screen Resized and Hidden
            if (settingsManager.trusatMode) {
                setTimeout(function () {
                  $('#loading-screen').removeClass('full-loader');
                  $('#loading-screen').addClass('mini-loader-container');
                  $('#logo-inner-container').addClass('mini-loader');
                  $('#logo-text').html('');
                  $('#logo-trusat').hide();
                  $('#loading-screen').hide();
                  $('#loader-text').html('Attempting to Math...');
                }, 5000);
            } else {
              $('#loading-screen').removeClass('full-loader');
              $('#loading-screen').addClass('mini-loader-container');
              $('#logo-inner-container').addClass('mini-loader');
              $('#logo-text').html('');
              $('#logo-trusat').hide();
              $('#loading-screen').hide();
              $('#loader-text').html('Attempting to Math...');
            }
          }

          if ($(window).width() > $(window).height()) {
            settingsManager.mapHeight = $(window).width(); // Subtract 12 px for the scroll
            $('#map-image').width(settingsManager.mapHeight);
            settingsManager.mapHeight = settingsManager.mapHeight * 3 / 4;
            $('#map-image').height(settingsManager.mapHeight);
            $('#map-menu').width($(window).width());
          } else {
            settingsManager.mapHeight = $(window).height() - 100; // Subtract 12 px for the scroll
            $('#map-image').height(settingsManager.mapHeight);
            settingsManager.mapHeight = settingsManager.mapHeight * 4 / 3;
            $('#map-image').width(settingsManager.mapHeight);
            $('#map-menu').width($(window).width());
          }
        }, 1500);

      })();
    });
  });
})();

function getSatIdFromCoord (x, y) {
  canvasManager.renderer.setRenderTarget(canvasManager.pickingTexture);
  canvasManager.renderer.clear();
  canvasManager.renderer.render(canvasManager.pickingScene, canvasManager.controls.object);
  canvasManager.renderer.setRenderTarget(null);
  canvasManager.pixelBuffer = new Uint8Array(4);
  canvasManager.renderer.readRenderTargetPixels(
    canvasManager.pickingTexture, x, canvasManager.renderer.getContext().drawingBufferHeight - y,
    1, 1, canvasManager.pixelBuffer );
  return ((canvasManager.pixelBuffer[2] << 16) | (canvasManager.pixelBuffer[1] << 8) | (canvasManager.pixelBuffer[0])) - 1;
}

function camSnap (pitch, yaw) {
  camPitchTarget = pitch;
  camYawTarget = _normalizeAngle(yaw);
  camSnapMode = true;
}

var isSelectedSatNegativeOne = false;
function selectSat (satId) {
  db.log('selectSat');
  db.log(`satId: ${satId}`, true);
  var sat;
  if (satId !== -1) {
    sat = satSet.getSat(satId);
    if (sat.type == 'Star') return;
    if ((sat.active == false || typeof sat.active == 'undefined') && typeof sat.staticNum == 'undefined') return; // Non-Missile Non-Sensor Object
  }
  satSet.selectSat(satId);
  camSnapMode = false;

  if (satId === -1) {
    if (settingsManager.currentColorScheme === ColorScheme.group || $('#search').val().length >= 3) { // If group selected
      $('#menu-sat-fov').removeClass('bmenu-item-disabled');
    } else {
      $('#menu-sat-fov').removeClass('bmenu-item-selected');
      $('#menu-sat-fov').addClass('bmenu-item-disabled');
      settingsManager.isSatOverflyModeOn = false;
      satCruncher.postMessage({
        isShowSatOverfly: 'reset'
      });
    }
  }

  if (satId === -1 && !isSelectedSatNegativeOne) {
    isSelectedSatNegativeOne = true;
    $('#sat-infobox').fadeOut();
    // $('#iss-stream').html('');
    // $('#iss-stream-menu').effect('slide', { direction: 'left', mode: 'hide' }, 1000);
    orbitDisplay.clearSelectOrbit();
    // Remove Red Box
    $('#menu-lookanglesmultisite').removeClass('bmenu-item-selected');
    $('#menu-lookangles').removeClass('bmenu-item-selected');
    $('#menu-editSat').removeClass('bmenu-item-selected');

    $('#menu-map').removeClass('bmenu-item-selected');
    $('#menu-newLaunch').removeClass('bmenu-item-selected');
    $('#menu-breakup').removeClass('bmenu-item-selected');
    $('#menu-customSensor').removeClass('bmenu-item-selected');
    // Add Grey Out
    $('#menu-lookanglesmultisite').addClass('bmenu-item-disabled');
    $('#menu-lookangles').addClass('bmenu-item-disabled');
    $('#menu-satview').addClass('bmenu-item-disabled');
    $('#menu-editSat').addClass('bmenu-item-disabled');
    $('#menu-map').addClass('bmenu-item-disabled');
    $('#menu-newLaunch').addClass('bmenu-item-disabled');
    $('#menu-breakup').addClass('bmenu-item-disabled');
    // Remove Side Menus
    // $('#lookanglesmultisite-menu').effect('slide', { direction: 'left', mode: 'hide' }, 1000);
    // $('#lookangles-menu').effect('slide', { direction: 'left', mode: 'hide' }, 1000);
    $('#editSat-menu').effect('slide', { direction: 'left', mode: 'hide' }, 1000);
    $('#map-menu').effect('slide', { direction: 'left', mode: 'hide' }, 1000);
    $('#newLaunch-menu').effect('slide', { direction: 'left', mode: 'hide' }, 1000);
    $('#breakup-menu').effect('slide', { direction: 'left', mode: 'hide' }, 1000);
    $('#customSensor-menu').effect('slide', { direction: 'left', mode: 'hide' }, 1000);
    // Toggle the side menus as closed
    isEditSatMenuOpen = false;
    isLookanglesMenuOpen = false;
    settingsManager.isMapMenuOpen = false;
    isLookanglesMultiSiteMenuOpen = false;
    isNewLaunchMenuOpen = false;
    isBreakupMenuOpen = false;
    isMissileMenuOpen = false;
    isCustomSensorMenuOpen = false;
  } else {
    isSelectedSatNegativeOne = false;
    selectedSat = satId;
    sat = satSet.getSatExtraOnly(satId);
    if (!sat) return;
    if (sat.type == 'Star') { return; }
    if (sat.static) {
      if (typeof sat.staticNum == 'undefined') return;
      adviceList.sensor();
      sat = satSet.getSat(satId);
      if (objectManager.isSensorManagerLoaded) sensorManager.setSensor(null, sat.staticNum); // Pass staticNum to identify which sensor the user clicked
      if (objectManager.isSensorManagerLoaded) sensorManager.curSensorPositon = [sat.position.x, sat.position.y, sat.position.z];
      selectedSat = -1;
      $('#menu-sensor-info').removeClass('bmenu-item-disabled');
      $('#menu-fov-bubble').removeClass('bmenu-item-disabled');
      $('#menu-surveillance').removeClass('bmenu-item-disabled');
      $('#menu-planetarium').removeClass('bmenu-item-disabled');
      $('#menu-astronomy').removeClass('bmenu-item-disabled');
      if (selectedSat !== -1) {
        $('#menu-lookangles').removeClass('bmenu-item-disabled');
      }
      return;
    }

    orbitDisplay.setSelectOrbit(satId);

    if (objectManager.isSensorManagerLoaded && sensorManager.checkSensorSelected()) {
      $('#menu-lookangles').removeClass('bmenu-item-disabled');
    }

    $('#menu-lookanglesmultisite').removeClass('bmenu-item-disabled');
    $('#menu-satview').removeClass('bmenu-item-disabled');
    $('#menu-editSat').removeClass('bmenu-item-disabled');
    $('#menu-sat-fov').removeClass('bmenu-item-disabled');
    $('#menu-map').removeClass('bmenu-item-disabled');
    $('#menu-newLaunch').removeClass('bmenu-item-disabled');

    if ($('#search-results').css('display') === 'block') {
      if (window.innerWidth <= 1000) {
      } else {
        $('#search-results').attr('style', 'display:block; max-height:27%');
        if (canvasManager.cameraManager.cameraType.current !== canvasManager.cameraManager.cameraType.PLANETARIUM) {
          // Unclear why this was needed...
          // uiManager.legendMenuChange('default');
        }
      }
    } else {
      if (window.innerWidth <= 1000) {
      } else {
        $('#search-results').attr('style', 'max-height:27%');
        if (canvasManager.cameraManager.cameraType.current !== canvasManager.cameraManager.cameraType.PLANETARIUM) {
          // Unclear why this was needed...
          // uiManager.legendMenuChange('default');
        }
      }
    }

    if (!sat.missile) {
      $('.sat-only-info').show();
    } else {
      $('.sat-only-info').hide();
    }

    $('#sat-infobox').fadeIn();
    $('#sat-info-title').html(sat.ON);

    if (sat.URL && sat.URL !== '') {
      $('#sat-info-title').html("<a class='iframe' href='" + sat.URL + "'>" + sat.ON + '</a>');
    }

    $('#edit-satinfo-link').html("<a class='iframe' href='editor.htm?scc=" + sat.SCC_NUM + "&popup=true'>Edit Satellite Info"+'</a>');

    $('#sat-intl-des').html(sat.intlDes);
    if (sat.OT === 'unknown') {
      $('#sat-objnum').html(1 + sat.TLE2.substr(2, 7).toString());
    } else {
      //      $('#sat-objnum').html(sat.TLE2.substr(2,7));
      $('#sat-objnum').html(sat.SCC_NUM);
      ga('send', 'event', 'Satellite', 'SCC: ' + sat.SCC_NUM, 'SCC Number');
    }

    var objtype;
    if (sat.OT === 0) { objtype = 'TBA'; }
    if (sat.OT === 1) { objtype = 'Payload'; }
    if (sat.OT === 2) { objtype = 'Rocket Body'; }
    if (sat.OT === 3) { objtype = 'Debris'; }
    if (sat.OT === 4) { objtype = 'Amateur Report'; }
    if (sat.missile) { objtype = 'Ballistic Missile'; }
    $('#sat-type').html(objtype);

    // /////////////////////////////////////////////////////////////////////////
    // Country Correlation Table
    // /////////////////////////////////////////////////////////////////////////
    var country;
    country = objectManager.extractCountry(sat.C);
    $('#sat-country').html(country);

    // /////////////////////////////////////////////////////////////////////////
    // Launch Site Correlation Table
    // /////////////////////////////////////////////////////////////////////////
    var site = [];
    var missileLV;
    var missileOrigin;
    if (sat.missile) {
      site = sat.desc.split('(');
      missileOrigin = site[0].substr(0, (site[0].length - 1));
      missileLV = sat.desc.split('(')[1].split(')')[0]; // Remove the () from the booster type

      site.site = missileOrigin;
      site.sitec = sat.C;
    } else {
      site = objectManager.extractLaunchSite(sat.LS);
    }

    $('#sat-site').html(site.site);
    $('#sat-sitec').html(site.sitec);

    ga('send', 'event', 'Satellite', 'Country: ' + country, 'Country');
    ga('send', 'event', 'Satellite', 'Site: ' + site, 'Site');

    // /////////////////////////////////////////////////////////////////////////
    // Launch Vehicle Correlation Table
    // /////////////////////////////////////////////////////////////////////////
    if (sat.missile) {
      sat.LV = missileLV;
      $('#sat-vehicle').html(sat.LV);
    } else {
      $('#sat-vehicle').html(sat.LV); // Set to JSON record
      if (sat.LV === 'U') { $('#sat-vehicle').html('Unknown'); } // Replace with Unknown if necessary
      objectManager.extractLiftVehicle(sat.LV); // Replace with link if available
    }

    // /////////////////////////////////////////////////////////////////////////
    // RCS Correlation Table
    // /////////////////////////////////////////////////////////////////////////
    if (sat.R === null || typeof sat.R == 'undefined') {
      $('#sat-rcs').html('Unknown');
    } else {
      var rcs;
      if (sat.R < 0.1) { rcs = 'Small'; }
      if (sat.R >= 0.1) { rcs = 'Medium'; }
      if (sat.R > 1) { rcs = 'Large'; }
      $('#sat-rcs').html(rcs);
      $('#sat-rcs').tooltip({delay: 50, html: sat.R, position: 'left'});
    }

    if (!sat.missile) {
      $('a.iframe').colorbox({iframe: true, width: '80%', height: '80%', fastIframe: false, closeButton: false});
      $('#sat-apogee').html(sat.apogee.toFixed(0) + ' km');
      $('#sat-perigee').html(sat.perigee.toFixed(0) + ' km');
      $('#sat-inclination').html((sat.inclination * RAD2DEG).toFixed(2) + '°');
      $('#sat-eccentricity').html((sat.eccentricity).toFixed(3));

      $('#sat-period').html(sat.period.toFixed(2) + ' min');
      $('#sat-period').tooltip({delay: 50, html: 'Mean Motion: ' + MINUTES_PER_DAY / sat.period.toFixed(2), position: 'left'});

      if (typeof sat.U != 'undefined' && sat.U != '') {
        $('#sat-user').html(sat.U);
      } else {
        $('#sat-user').html('Unknown');
      }
      if (typeof sat.P != 'undefined' && sat.P != '') {
        $('#sat-purpose').html(sat.P);
      } else {
        $('#sat-purpose').html('Unknown');
      }
      if (typeof sat.Con != 'undefined' && sat.Con != '') {
        $('#sat-contractor').html(sat.Con);
      } else {
        $('#sat-contractor').html('Unknown');
      }
      if (typeof sat.LM != 'undefined' && sat.LM != '') {
        $('#sat-lmass').html(sat.LM + ' kg');
      } else {
        $('#sat-lmass').html('Unknown');
      }
      if (typeof sat.DM != 'undefined' && sat.DM != '') {
        $('#sat-dmass').html(sat.DM + ' kg');
      } else {
        $('#sat-dmass').html('Unknown');
      }
      if (typeof sat.Li != 'undefined' && sat.Li != '') {
        $('#sat-life').html(sat.Li + ' yrs');
      } else {
        $('#sat-life').html('Unknown');
      }
      if (typeof sat.Pw != 'undefined' && sat.Pw != '') {
        $('#sat-power').html(sat.Pw + ' w');
      } else {
        $('#sat-power').html('Unknown');
      }
      if (typeof sat.vmag != 'undefined' && sat.vmag != '') {
        $('#sat-vmag').html(sat.vmag);
      } else {
        $('#sat-vmag').html('Unknown');
      }
      if (typeof sat.S1 != 'undefined' && sat.S1 != '') {
        $('#sat-source1').html(`<a class="iframe" href="${sat.S1}">${sat.S1.split('//').splice(1)}</a>`);
        $('#sat-source1w').show();
      } else {
        $('#sat-source1').html('Unknown');
        $('#sat-source1w').hide();
      }
      if (typeof sat.S2 != 'undefined' && sat.S2 != '') {
        $('#sat-source2').html(`<a class="iframe" href="${sat.S2}">${sat.S2.split('//').splice(1)}</a>`);
        $('#sat-source2w').show();
      } else {
        $('#sat-source2').html('Unknown');
        $('#sat-source2w').hide();
      }
      if (typeof sat.S3 != 'undefined' && sat.S3 != '') {
        $('#sat-source3').html(`<a class="iframe" href="${sat.S3}">${sat.S3.split('//').splice(1)}</a>`);
        $('#sat-source3w').show();
      } else {
        $('#sat-source3').html('Unknown');
        $('#sat-source3w').hide();
      }
      if (typeof sat.S4 != 'undefined' && sat.S4 != '') {
        $('#sat-source4').html(`<a class="iframe" href="${sat.S4}">${sat.S4.split('//').splice(1)}</a>`);
        $('#sat-source4w').show();
      } else {
        $('#sat-source4').html('Unknown');
        $('#sat-source4w').hide();
      }
      if (typeof sat.S5 != 'undefined' && sat.S5 != '') {
        $('#sat-source5').html(`<a class="iframe" href="${sat.S5}">${sat.S5.split('//').splice(1)}</a>`);
        $('#sat-source5w').show();
      } else {
        $('#sat-source5').html('Unknown');
        $('#sat-source5w').hide();
      }
      if (typeof sat.S6 != 'undefined' && sat.S6 != '') {
        $('#sat-source6').html(`<a class="iframe" href="${sat.S6}">${sat.S6.split('//').splice(1)}</a>`);
        $('#sat-source6w').show();
      } else {
        $('#sat-source6').html('Unknown');
        $('#sat-source6w').hide();
      }
      if (typeof sat.S7 != 'undefined' && sat.S7 != '') {
        $('#sat-source7').html(`<a class="iframe" href="${sat.S7}">${sat.S7.split('//').splice(1)}</a>`);
        $('#sat-source7w').show();
      } else {
        $('#sat-source7').html('Unknown');
        $('#sat-source7w').hide();
      }
      if (typeof sat.URL != 'undefined' && sat.URL != '') {
        $('#sat-sourceURL').html(`<a class="iframe" href="${sat.URL}">${sat.URL.split('//').splice(1)}</a>`);
        $('#sat-source8w').show();
      } else {
        $('#sat-source8').html('Unknown');
        $('#sat-source8w').hide();
      }
      $('a.iframe').colorbox({iframe: true, width: '80%', height: '80%', fastIframe: false, closeButton: false});

      // TODO: Error checking on Iframe

      var now = new Date();
      var jday = timeManager.getDayOfYear(now);
      now = now.getFullYear();
      now = now.toString().substr(2, 2);
      var daysold;
      if (satSet.getSat(satId).TLE1.substr(18, 2) === now) {
        daysold = jday - satSet.getSat(satId).TLE1.substr(20, 3);
      } else {
        daysold = jday - satSet.getSat(satId).TLE1.substr(20, 3) + (satSet.getSat(satId).TLE1.substr(17, 2) * 365);
      }
      $('#sat-elset-age').html(daysold + ' Days');
      $('#sat-elset-age').tooltip({delay: 50, html: 'Epoch Year: ' + sat.TLE1.substr(18, 2).toString() + ' Day: ' + sat.TLE1.substr(20, 8).toString(), position: 'left'});

      if (!objectManager.isSensorManagerLoaded) {
        $('#sat-sun').parent().hide();
      } else {
        now = new Date(timeManager.propRealTime + timeManager.propOffset);
        var sunTime = SunCalc.getTimes(now, sensorManager.currentSensor.lat, sensorManager.currentSensor.long);
        var satInSun = sat.isInSun;
        // If No Sensor, then Ignore Sun Exclusion
        if (!sensorManager.checkSensorSelected()) {
          if (satInSun == 0) $('#sat-sun').html('No Sunlight');
          if (satInSun == 1) $('#sat-sun').html('Limited Sunlight');
          if (satInSun == 2) $('#sat-sun').html('Direct Sunlight');
        // If Radar Selected, then Say the Sun Doesn't Matter
        } else if ((sensorManager.currentSensor.type !== 'Optical') && (sensorManager.currentSensor.type !== 'Observer')) {
          $('#sat-sun').html('No Effect');
        // If Dawn Dusk Can be Calculated then show if the satellite is in the sun
        } else if (sunTime.dawn.getTime() - now > 0 || sunTime.dusk.getTime() - now < 0) {
          if (satInSun == 0) $('#sat-sun').html('No Sunlight');
          if (satInSun == 1) $('#sat-sun').html('Limited Sunlight');
          if (satInSun == 2) $('#sat-sun').html('Direct Sunlight');
        // If Optical Sesnor but Dawn Dusk Can't Be Calculated, then you are at a
        // high latitude and we need to figure that out
        } else if ((sunTime.night != 'Invalid Date') && (sunTime.dawn == 'Invalid Date' || sunTime.dusk == 'Invalid Date')) {
            if (satInSun == 0) $('#sat-sun').html('No Sunlight');
            if (satInSun == 1) $('#sat-sun').html('Limited Sunlight');
            if (satInSun == 2) $('#sat-sun').html('Direct Sunlight');
        } else {
        // Unless you are in sun exclusion
        $('#sat-sun').html('Sun Exclusion');
        }
      }
    }

    if (objectManager.isSensorManagerLoaded && sensorManager.checkSensorSelected() && isLookanglesMenuOpen) {
      satellite.getlookangles(sat);
    }
  }

  selectedSat = satId;

  if (satId !== -1) {
    if (typeof sat.TTP != 'undefined') {
      $('#sat-ttp-wrapper').show();
      $('#sat-ttp').html(sat.TTP);
    } else {
      $('#sat-ttp-wrapper').hide();
    }
    if (typeof sat.NOTES != 'undefined') {
      $('#sat-notes-wrapper').show();
      $('#sat-notes').html(sat.NOTES);
    } else {
      $('#sat-notes-wrapper').hide();
    }
    if (typeof sat.FMISSED != 'undefined') {
      $('#sat-fmissed-wrapper').show();
      $('#sat-fmissed').html(sat.FMISSED);
    } else {
      $('#sat-fmissed-wrapper').hide();
    }
    if (typeof sat.ORPO != 'undefined') {
      $('#sat-oRPO-wrapper').show();
      $('#sat-oRPO').html(sat.ORPO);
    } else {
      $('#sat-oRPO-wrapper').hide();
    }
    if (typeof sat.constellation != 'undefined') {
      $('#sat-constellation-wrapper').show();
      $('#sat-constellation').html(sat.constellation);
    } else {
      $('#sat-constellation-wrapper').hide();
    }
    if (typeof sat.maneuver != 'undefined') {
      $('#sat-maneuver-wrapper').show();
      $('#sat-maneuver').html(sat.maneuver);
    } else {
      $('#sat-maneuver-wrapper').hide();
    }
    if (typeof sat.associates != 'undefined') {
      $('#sat-associates-wrapper').show();
      $('#sat-associates').html(sat.associates);
    } else {
      $('#sat-associates-wrapper').hide();
    }
    uiManager.updateMap();

    // ISS Stream Slows Down a Lot Of Computers
    // if (sat.SCC_NUM === '25544') { // ISS is Selected
    //   $('#iss-stream-menu').show();
    //   $('#iss-stream').html('<iframe src="http://www.ustream.tv/embed/17074538?html5ui=1" allowfullscreen="true" webkitallowfullscreen="true" scrolling="no" frameborder="0" style="border: 0px none transparent;"></iframe><iframe src="http://www.ustream.tv/embed/9408562?html5ui=1" allowfullscreen="true" webkitallowfullscreen="true" scrolling="no" frameborder="0" style="border: 0px none transparent;"></iframe><br />' +
    //                         '<iframe src="http://www.ustream.tv/embed/6540154?html5ui=1" allowfullscreen="true" webkitallowfullscreen="true" scrolling="no" frameborder="0" style="border: 0px none transparent;"></iframe><iframe src="http://cdn.livestream.com/embed/spaceflightnow?layout=4&amp;height=340&amp;width=560&amp;autoplay=false" style="border:0;outline:0" frameborder="0" scrolling="no"></iframe>');
    // } else {
    //   $('#iss-stream').html('');
    //   $('#iss-stream-menu').hide();
    // }
  }
}
function enableSlowCPUMode () {
  db.log('enableSlowCPUMode');
  if (!settingsManager.cruncherReady) return;
  settingsManager.isSlowCPUModeEnabled = true;
  settingsManager.minimumSearchCharacters = 3;
  settingsManager.satLabelInterval = 500;

  satCruncher.postMessage({
    isSlowCPUModeEnabled: true
  });
}
