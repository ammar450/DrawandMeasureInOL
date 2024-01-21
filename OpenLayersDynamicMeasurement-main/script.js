// Initialize OpenLayers Map
var olMap = new ol.Map({
  target: 'map',
  layers: [new ol.layer.Tile({source: new ol.source.OSM()})],
  view: new ol.View({
      center: ol.proj.fromLonLat([126.9780, 37.5665]),
      zoom: 10
  })
});

// VectorLayer Class
class VectorLayer {
  constructor(title, map) {
    this.layer = new ol.layer.Vector({
      title: title,
      source: new ol.source.Vector(),
      style: new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: '#0e97fa',
          width: 4
        })
      })
    });
    map.addLayer(this.layer);
  }
}

// Overlay Class
class Overlay {
  constructor(map, element = document.getElementById("popup"), offset = [0, -15], positioning = 'bottom-center', className = 'ol-tooltip-measure ol-tooltip .ol-tooltip-static') {
    this.overlay = new ol.Overlay({
      element: element,
      offset: offset,
      positioning: positioning,
      className: className
    });
    map.addOverlay(this.overlay);
  }
}

// Draw Class
class Draw {
  constructor(type, map, vector_layer) {
    this.map = map;
    this.vector_layer = vector_layer;
    this.draw = new ol.interaction.Draw({
        type: type,
        stopClick: true
    });
    this.map.addInteraction(this.draw);

    this.draw.on('drawstart', (e) => this.onDrawStart(e));
    this.draw.on('drawend', (e) => this.onDrawEnd(e));
  }
  onDrawStart = (e) => {      
    //It will store the coordinates length of geometry
    this.coordinates_length = 0;

    //partDistanceOverlay is used to display the label of distance measurements on each segment of Line and Polygon geomtry
    this.partDistanceOverlay = null;

    //totalAreaDistanceOverlay is used to display the total distance if geomtery is LineString or it will display the area if geomtry is Polygon
    this.totalAreaDistanceOverlay = new Overlay(this.map).overlay;

    //lastPartLineOverlay is used to display the distance measurement of last segment of Polygon which is its last two coordinates
    this.lastPartLineOverlay = new Overlay(this.map).overlay;
    
    //Binding onGeomChange function with drawing feature
    e.feature.getGeometry().on('change', this.onGeomChange); 
  }
  

  /*
  This function will be called when drawing is finished
  */
  onDrawEnd = (e) => {  
    //Add drawn geometry to vector layer          
    this.vector_layer.getSource().addFeature(e.feature);
  }


  /*
  This function will called when ever there will be a change in geometry like increase in length, area, position,
  */
  onGeomChange = (e) => {    
    let geomType = e.target.getType();
    let coordinates = e.target.getCoordinates();
    if(geomType == "Polygon"){
      coordinates = e.target.getCoordinates()[0];
    }    

    //This logic will check if the new coordinates are added to geometry. If yes, then It will create a overlay for the new segment
    if (coordinates.length > this.coordinates_length) {                
      this.partDistanceOverlay = new Overlay(this.map).overlay;
      this.coordinates_length =  coordinates.length;      
    }
    else {                     
      this.coordinates_length =  coordinates.length;            
    }    
    
    let partLine = new ol.geom.LineString([coordinates[this.coordinates_length-2], coordinates[this.coordinates_length-1]]);    

    if(geomType == "Polygon") {
      partLine = new ol.geom.LineString([coordinates[this.coordinates_length-3], coordinates[this.coordinates_length-2]]);    
    }  

    //the calculates the length of a segment and position the overlay at the midpoint of it
    this.calDistance(this.partDistanceOverlay, partLine.getFlatMidpoint(), partLine.getLength());  

    //if geometry is LineString and coordinates_length is greater than 2, then calculate the total length of the line and set the position of the overlay at last coordninates
    if (geomType == "LineString" && this.coordinates_length > 2 && e.target.getLength() > new ol.geom.LineString([coordinates[0], coordinates[1]]).getLength()) {
      this.calDistance(this.totalAreaDistanceOverlay, coordinates[this.coordinates_length-1], ol.sphere.getLength(e.target));
    }  

    //If geometry is Polygon, then it will create the overlay for area measurement and last segment of it which is its first and last coordinates.
    if (geomType == "Polygon" && this.coordinates_length > 3) {
      this.calArea(this.totalAreaDistanceOverlay, e.target.getFlatInteriorPoint(), ol.sphere.getArea(e.target));      
      partLine = new ol.geom.LineString([coordinates[this.coordinates_length-2], coordinates[this.coordinates_length-1]]);    
      this.calDistance(this.lastPartLineOverlay, partLine.getFlatMidpoint(), ol.sphere.getLength(partLine));
    } 
  }


  //Calculates the length of a segment and position the overlay at the midpoint of it.
  calDistance = (overlay, overlayPosition, distance) => {  
    if(parseInt(distance) == 0) {    
      overlay.setPosition([0,0]);       
    }
    else {
      overlay.setPosition(overlayPosition);      
      if (distance >= 1000) {
        overlay.element.innerHTML = (distance/1000).toFixed(2) + ' km';
      }
      else {
        overlay.element.innerHTML = distance.toFixed(2) + ' m';
      }
    }    
  }


  //Calculates the area of Polygon and position the overlay at the center of polygon
  calArea = (overlay, overlayPosition, area) => {    
    if(parseInt(area) == 0) {    
      overlay.setPosition([0,0]);  
    }
    else {
      overlay.setPosition(overlayPosition);  
      if (area >= 10000) {
        overlay.element.innerHTML = Math.round((area / 1000000) * 100) / 100  + ' km<sup>2<sup>';
      }
      else {
        overlay.element.innerHTML =  Math.round(area * 100) / 100  + ' m<sup>2<sup>';
      }
    }   
  }

}

let vector_layer = new VectorLayer('Temp Layer', olMap);


// Function to post map view changes to the iframe
function postMapViewToIframe() {
  const mapView = olMap.getView();
  const center = ol.proj.toLonLat(mapView.getCenter());
  const zoom = mapView.getZoom();
  
  const iframeWindow = document.querySelector('#cadastralIframe iframe').contentWindow;
  iframeWindow.postMessage({ center, zoom }, '*');
}

// Add event listeners to post messages when the map view changes
olMap.on('moveend', postMapViewToIframe);

// Interaction management
let draw = null;
let btnClick = (geomType) => {
  removeInteractions();
  draw = new Draw(geomType, olMap, vector_layer.layer);
}

// Remove interactions
let removeInteractions = () => {
  olMap.getInteractions().getArray().slice(9).forEach(interaction => {
    olMap.removeInteraction(interaction);
  });
}

// Clear vector features and overlays
let clear = () => {
  removeInteractions();
  olMap.getOverlays().clear();
  vector_layer.layer.getSource().clear();
}

// Bind methods to button click events
document.getElementById('btn1').onclick = () => btnClick('LineString');
document.getElementById('btn2').onclick = () => btnClick('Polygon');
document.getElementById('btn3').onclick = clear;


  


