'use strict';

var module = (function() {

var table;
var map;
var birds = [];
var markers = [];
var colorCounter = 0;
var palette = [
    'FFE686',
    'E8A05E',
    'FF7E74',
    'DE5EE8',
    '8167FF'
];

var Data = function(row) {
    var data = {};
    data.dateTime = new Date(row[0]);
    data.lat = row[1];
    data.lon = row[2];
    data.course = row[3];
    data.altitude = row[4];
    data.hdop = row[5];
    data.vdop = row[6];
    data.satelliteCount = row[7];
    data.shownInKML = row[8];
    data.fileDate = row[10];
    return data;
};

var Bird = function(row) {
    var bird = {};
    bird.gsmId = parseInt(row[10]);
    bird.data = [new Data(row)];
    return bird;
};

function toRad(Value) {
    return Value * Math.PI / 180;
}

function coordinatesToDistance(lat1, lat2, lon1, lon2) {
    var R = 6371000;        // earth radius
    var phi1 = toRad(lat1);
    var phi2 = toRad(lat2);
    var deltaPhi = toRad(lat2-lat1);
    var deltaLambda = toRad(lon2-lon1);

    var a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return Math.ceil(R * c); 
};

function calculateBirdActivity(birds) {
    var lastDataDate;
    birds.forEach(function(bird) {

        // sort from later to sooner
        bird.data.sort(function(a, b) {
            return moment(b.dateTime).diff(moment(a.dateTime));
        });

        // init the count of used data
        bird.usedData = 0;
        lastDataDate = bird.data[0].dateTime;

        // calculate distance from n to n+1
        for (var i = 0; i < bird.data.length - 1; i++) {

            // if point is before last position's datetime minus the limit-hour, we stop counting the distance
            if ( moment(lastDataDate).subtract(parseInt($('#limit-hour').val()), 'hour').diff(moment(bird.data[i+1].dateTime)) > 0) {
                break;
            }

            bird.usedData++;
            bird.distanceCovered = coordinatesToDistance(bird.data[i].lat, bird.data[i+1].lat, bird.data[i].lon, bird.data[i+1].lon);
        }
    });
    return birds;
};

// Inflate the datatable
function displayResult(birds) {
    table.clear();
    birds.forEach(function(bird) {
        table.row.add([
            bird.gsmId,
            bird.data.length,
            bird.usedData,
            bird.data[0].dateTime.toDateString()+' '+bird.data[0].dateTime.toLocaleTimeString(),
            bird.distanceCovered,
            bird.data[0].lat,
            bird.data[0].lon
        ]).draw();
    });
};

// Read a file
function readFile(event) {
    var reader = new FileReader();
    reader.onload = function() {
        var text = reader.result;
        computeData(text);
    };
    reader.readAsText(event.target.files[0]);
};

// Start parsing the data to create the birds objects before displaying them
function computeData(_data) {
    var isNewBird;
    var gsmId;
    var data;
    if (_data) {
        data = _data;
    } else {
        data = $('#data').val();
    }
    if (data === undefined) {
        return alert('There is no data to process.');
    }
    var rows = data.split('\n');

    for (var i = rows.length - 1; i >= 0; i--) {
        isNewBird = true;
        rows[i] = rows[i].split('\t');
        gsmId = parseInt(rows[i][10]);

        for (var j = birds.length - 1; j >= 0; j--) {
            birds[j].distanceCovered = 0;

            if (gsmId === birds[j].gsmId) {
                isNewBird = false;
                birds[j].data.push(new Data(rows[i]));
            }
        };

        if (isNewBird && !isNaN(gsmId)) {
            birds.push(new Bird(rows[i]));
        }
    };

    birds = calculateBirdActivity(birds);

    displayResult(birds);
};

// Display markers on map at each bird position known
function showOnMap(data) {
    birds.forEach(function(bird) {
        if (bird.gsmId === data[0]) {
            for (var i = bird.data.length - 1; i >= 0; i--) {
                var marker = new google.maps.Marker({
                  position: { lat: parseFloat(bird.data[i].lat), lng: parseFloat(bird.data[i].lon)},
                  map: map,
                  icon: 'http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld='+i+'|'+palette[colorCounter % palette.length]+'|000000',
                  title: 'Bird '+bird.gsmId+ ' ' +bird.data[i].dateTime.toDateString()+' '+bird.data[i].dateTime.toLocaleTimeString()+ ' {lat:' +bird.data[i].lat +', lon:'+ bird.data[i].lon +'}'
                });
                marker.setMap(map);
                markers.push(marker);
            };

            // Center on last position
            map.setCenter(markers[markers.length-1].position);
            map.setZoom(12);

            colorCounter++;
            return;
        }
    });
};

// Clean the maps from all the markers
function clearOverlays() {
  for (var i = 0; i < markers.length; i++ ) {
    markers[i].setMap(null);
  }
  markers.length = 0;
  colorCounter = 0;
}

$(document).ready(function() {
    table = $('#result').DataTable({
        paginate: false,
        fnRowCallback: function( nRow, aData, iDisplayIndex ) {
            if (aData[4] < $('#limit-dist').val())  {
                nRow.className = "danger";
            }

            // Bind click event
            $(nRow).click(function() {
                showOnMap(aData);
            });
            return nRow;
        }
    });

    var mapOptions = {
        mapTypeId: 'satellite',
        center: { lat: 33.202251, lng: -3.820182},
        zoom: 9
    };
    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
});

return {
    clearOverlays: clearOverlays,
    readFile: readFile,
    computeData: computeData
};

}());
