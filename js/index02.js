var zoom = d3.behavior.zoom()
.scale(1)
.translate([0, 0])
.scaleExtent([1, 15])
.on("zoom", move);

var width = document.getElementById('container').offsetWidth;
var height = width /2;
var topo, projection, path, svg, g, locList, eventlist, statusType, diseaseList, disease;
var selectEvent = -1;
var levelColor = ["#73bf00", "#e1e100", "#f75000", "#ce0000"];
var levelText = ["普通", "第一級:注意(Watch), 提醒遵守當地的一般預防措施 ", "第二級:警示(Alert), 對當地採取加強防護", "第三級:警告(Warning), 避免至當地所有非必要旅遊"];
var graticule = d3.geo.graticule();
var tooltip = d3.select("#container").append("div").attr("class", "tooltip hidden");
var drag = d3.behavior.drag()
            .origin(function() {
              var r = projection.rotate();
              //console.log(r);
              return {x: 10*r[0], y: -10*r[1]};
            })
            .on("drag", function() {
              var r = projection.rotate();
              console.log(d3.event.x, -d3.event.y);
              projection.rotate([0.1*d3.event.x, -0.1*d3.event.y, r[2]]);
              d3.select("svg").selectAll("path").attr("d",path);
            });
var undrag = d3.behavior.drag().origin(null).on("drag", null);

$(document).ready(function(){
  d3.select(window).on("resize", throttle);
  setup(width,height);
  statusType = 0;
  $.getJSON("https://mingjii.github.io/webFront/lnglat.json", function(result){
    locList = result;
  });
  $.getJSON("https://mingjii.github.io/webFront/dicease.json", function(data){
	  diseaseList = data;
  });

  $.getJSON("https://mingjii.github.io/webFront/data.json", function(result){
    var count = 0;
    var arr = []
    for(var tag in result){
      arr[count] = result[tag];
      count++;
    }
    eventlist = arr.reverse();
  });

  d3.json("https://api.github.com/gists/9398333", function(error, root) {

    var world = root.files['world.json'].content
    world = JSON.parse(world)
    var countries = topojson.feature(world, world.objects.countries).features;
    countries[52].properties.name = "Curacao";
    countries[223].properties.name = "Taiwan";

    for(var i in countries){
      countries[i]["properties"]["severity_level"] = -1;
    }

    var nowTime = new Date();
    for(var tag in eventlist){
      var elementTime = new Date(eventlist[tag]["expires"]);
      var ID = eventlist[tag]["countryID"];
      var countryLevel = countries[ID]["properties"]["severity_level"];
      var level = eventlist[tag]["severity_level"];
      //console.log(elementTime.getTime() , nowTime.getTime());
      if(elementTime.getTime() > nowTime.getTime()){
        //console.log(level, countryLevel);
        if(level > countryLevel){
          countries[ID]["properties"]["severity_level"] = level;
        }
      }

      var startTime = new Date(eventlist[tag]["effective"]);
      //console.log(eventlist[tag]["effective"]);
      var block = d3.select("#events").append("ul")
	    .text(eventlist[tag]["headline"]+"("+startTime.getFullYear()+"-"+(startTime.getMonth()+1)+"-"+startTime.getDate()+")")
      .attr("id", "event" + tag)
      .attr("countryID", ID)
      .attr("disease", eventlist[tag]["alert_disease"])
      .append("div")
      .style("display","none")

      block.append("p").text(function(){
        if(level >= 0) return levelText[level];
        else return "無害";
      })
      .style("color", "#FF8888");


      block.append("p").text("----"+eventlist[tag]["description"])
      .append("a").text("原文網站")
      .attr("href", eventlist[tag]["web"])
      .attr("target", "_blank")
      .style("font-size", "20px")
      .style("text-align", "center");



    }

    $("#events ul").on("click", function(){
      var ID = $(this).attr("id");
      if(selectEvent == ID){
        disease = null;
        $(this).attr("class", null).hide();
        selectEvent = -1;
      }
      else{
        $("#events ul .selectEvent").hide();
        $(this).attr("class", "selectEvent").show();
        selectEvent = ID;
        disease = $(this).attr("disease");
      }
      
    });
    $(".navbar .continents").click(function(){
      searchLoc($(this).attr("value"));
      console.log($(this).attr("value"));
    });
    topo = countries;
    draw(topo);

  });

});

function setup(width,height){
  projection = d3.geo.mercator()
  .translate([(width/2), (height/2)])
  .scale( width / 2 / Math.PI);


  path = d3.geo.path().projection(projection);

  svg = d3.select("#container").append("svg")
  .attr("width", width)
  .attr("height", height + 8)
  .call(zoom)
  .on("click", clickBoard);

  g = svg.append("g");
  
}


function draw(topo) {

  g.append("path")
  .datum(graticule)
  .attr("class", "graticule")
  .attr("d", path);

/*
  g.append("path")
  .datum({type: "LineString", coordinates: [[-180, 0], [-90, 0], [0, 0], [90, 0], [180, 0]]})
  .attr("class", "equator")
  .attr("d", path);
*/

  var country = g.selectAll(".country").data(topo);

  country.enter().insert("path")
  .attr("class", "country")
  .attr("d", path)
  .attr("id", function(d,i) { return d.id; })
  .attr("title", function(d,i) { return d.properties.name; })
  .style("fill", function(d, i) {
    if(d.properties.severity_level >= 0) return levelColor[d.properties.severity_level];
    else return "#49cc90";
  });


  g.selectAll(".country").data(locList)
  .attr("x", function(d,i){ return d.lng; })
  .attr("y", function(d,i){ return d.lat; });

  country = g.selectAll(".country").data(topo);
  //offsets for tooltips
  var offsetL = document.getElementById('container').offsetLeft+20;
  var offsetT = document.getElementById('container').offsetTop+10;

  //tooltips
  country
  .on("mousemove", function(d,i) {

    var mouse = d3.mouse(svg.node()).map( function(d) { return parseInt(d); } );

    tooltip.classed("hidden", false)
    .attr("style", "left:"+(mouse[0]+offsetL)+"px;top:"+(mouse[1]+offsetT)+"px")
    .html(d.properties.name);


    $("span.city").html(d.properties.name);
  })
  .on("mouseout",  function(d,i) {
    tooltip.classed("hidden", true);
    $("span.city").html($(".selected").attr("title"));
  });

  var exception = [];
  exception[0] = {id:228, x:449.9995097166665, y:266.9965807132182, scale:2.3748024515889967};
  exception[1] = {id:185, x:1523.2851362000001, y:60.98625147985143, scale:1.459992790176863};
    $(".country").click(function(){
      d3.selectAll(".selected").classed("selected", false);
      d3.select(this).classed("selected", true);
      //console.log($(this));
      console.log($(".selected"));
      var ID = $(this).attr("id");
      if(statusType == 0){
        var scale = -1;
        var t = [];
        var box = document.getElementById(ID).getBBox();
        var position = [box.x+box.width/2, box.y+box.height/2];
        var size = Math.max(box.width, box.height);
        for(var i=0 ; i<exception.length ; i++){
          if(ID == exception[i].id){
            position = [exception[i].x, exception[i].y];
            scale = exception[i].scale;
          }
        }
        if(scale == -1){
          scale = Math.min(15, 42/Math.sqrt(size));
        }
        t[0] = width/2 - scale*position[0];
        t[1] = height/2 - scale*position[1];
        zoom.translate(t).scale(scale);
        g.transition().duration(1000).attr("transform", "translate(" + t + ")scale(" + scale + ")");
        d3.selectAll(".country").style("stroke-width", 1.5 / scale);
        d3.selectAll(".selected").style("stroke-width", 3 / scale);
      }
      else if(statusType == 1){
        g.transition().duration(1250).tween("rotate", function(){
          var p = d3.geo.centroid(topo[ID]);
          var r = d3.interpolate(projection.rotate(), [-p[0], -p[1]]);
          console.log(p);
          return function (t) {
              projection.rotate(r(t));
              svg.selectAll("path").attr("d", path);
          }
        });
      }
      $("#events ul").each(function(){
        $(this).hide();
        if($(this).attr("countryID") == ID) $(this).show();
      });
      $("#eventCountry").text($("#"+ID).attr("title"));
      //return false;
    }); 
  /*
  $.getJSON( "http://smart-ip.net/geoip-json?callback=?",
        function(data){
            console.log( data);
          addpoint(data.longitude, data.latitude, data.city);
          $("span.city").html(data.city);
        }
    );*/

}


function redraw() {
  if(statusType == 0) mapType();
  else globalType();
}


function move() {

  var t = d3.event.translate;
  var s = d3.event.scale; 
  zscale = s;
  var h = height/4;
  //console.log(t, s);

  t[0] = Math.min(
    (width/height)  * (s - 1), 
    Math.max( width * (1 - s), t[0] )
  );

  t[1] = Math.min(
    h * (s - 1) + h * s, 
    Math.max(height  * (1 - s) - h * s, t[1])
  );

  zoom.translate(t);
  g.attr("transform", "translate(" + t + ")scale(" + s + ")");

  //adjust the country hover stroke width based on zoom level
  d3.selectAll(".country").style("stroke-width", 1.5 / s);
  d3.selectAll(".selected").style("stroke-width", 3 / s);

}

var throttleTimer;
function throttle() {
  window.clearTimeout(throttleTimer);
  throttleTimer = window.setTimeout(function() {
    redraw();
  }, 200);
}


//geo translation on mouse click in map
function clickBoard() {
  var latlon = projection.invert(d3.mouse(this));
  //console.log(latlon);
  //console.log(d3.mouse(this));
  console.log("clickBoard", d3.event.clientX, d3.event.clientY);
}


//function to add points and text to the map (used in plotting capitals)
function addpoint(longitude, latitude, text) {

  var gpoint = g.append("g").attr("class", "gpoint");
  var x = projection([longitude, latitude])[0];
  var y = projection([longitude, latitude])[1];

  gpoint.append("svg:circle")
  .attr("cx", x)
  .attr("cy", y)
  .attr("class","point")
  .attr("r", 2)
  .style("fill", "#fff");

  //conditional in case a point has no associated text
  if(text.length>0){
    gpoint.append("text")
    .attr("x", x+2)
    .attr("y", y+2)
    .attr("class","text")
    .text(text)
    .style("fill", "#fff");
  }

}

function globalType(){
    width = document.getElementById('container').offsetWidth;
    height = width / 2;
    statusType = 1;
    d3.select('svg').remove();
    setup(width,height);
    projection = d3.geo.orthographic().scale(600).translate([width/2,height/2]).clipAngle(90);
    path = d3.geo.path().projection(projection);
    zoom.on("zoom", null);
    svg.call(drag);
    draw(topo);
}

function mapType(){
  width = document.getElementById('container').offsetWidth;
  height = width / 2;
  statusType = 0;
  d3.select('svg').remove();
  setup(width,height);
  zoom.on("zoom", move).scale(1).translate([0, 0]);
  svg.call(undrag);
  draw(topo);
}

function changeMode(){
  if(statusType == 0) globalType();
  else mapType();
}

var geocoder;

function initMap(){
  geocoder = new google.maps.Geocoder();
}

function searchLoc(address=null){
  var s = 0;
  if(address == null) address = $("#searchText").val();
  else s=1;
  var loc = [], x, y, bound, fitScale, t = [];
  console.log(address);
  geocoder.geocode( { 'address': address}, function(results, status){
    if (status == 'OK'){
      loc = [results[0].geometry.location.lng(), results[0].geometry.location.lat()];
      console.log(results);
      x = projection(loc)[0];
      y = projection(loc)[1];
      console.log("prtojected xy", x, y);
      //drawPoint(x, y);

      var selectID = findSelected(loc, s);
      if(selectID==12)selectID=15;

      if(statusType == 0){
        g.transition().duration(1000).attr("transform", "translate(" + [0, 0] + ")scale(" + 1 + ")")
        .each("end", function(){
          //console.log(results[0].geometry.viewport);
          if(results[0].geometry.viewport){
            bound = results[0].geometry.viewport;
            fitScale = Math.max(Math.abs(bound.b.b-bound.b.f), Math.abs(bound.f.b-bound.f.f));
            fitScale = Math.min(15, 18/Math.sqrt(fitScale));
          }
          else fitScale = 1.5;
          console.log("fitScale:", fitScale);
          t[0] = width/2-fitScale*x;
          t[1] = height/2-fitScale*y;
          //console.log(t);
          zoom.translate(t).scale(fitScale);
          g.transition().duration(1250).attr("transform", "translate(" + t + ")scale(" + fitScale + ")");
          d3.selectAll(".country").style("stroke-width", 1.5 / fitScale);
          d3.selectAll(".selected").style("stroke-width", 3 / fitScale);
        });
      }
      else if(statusType == 1){
        g.transition().duration(1250).tween("rotate", function(){
          var p = d3.geo.centroid(topo[selectID]);
          var r = d3.interpolate(projection.rotate(), [-p[0], -p[1]]);
          console.log("rotate", p);
          return function (t) {
              projection.rotate(r(t));
              svg.selectAll("path").attr("d", path);
          }
        });
      }
    }
    else {
      console.log(status);
    }
  });


}

function drawPoint(x, y){
  $("circle").remove();
  g.append("circle")
    .attr({
      "cx": x,
      "cy": y,
      "r": 5,
      "fill": "#000",
    })
}

function findSelected(loc, s){
  var x = projection(loc)[0];
  var y = projection(loc)[1];
  var selectID = 0;
  var mini = 1000;
  var position = [];
  if(statusType == 0){
    $(".country").each(function(){
      //console.log($(this));
      var box = document.getElementById($(this).attr("id")).getBBox();
      var left_top = [box.x, box.y];
      var right_down = [left_top[0]+box.width, left_top[1]+box.height];
      if((x > left_top[0] && x < right_down[0]) && 
          (y > left_top[1] && y < right_down[1])){
        position[0] = loc[0] - $(this).attr("x");
        position[1] = loc[1] - $(this).attr("y");
        var d = Math.sqrt(Math.pow(position[0], 2)+Math.pow(position[1], 2));
        if(mini > d){
          mini = d;
          selectID = $(this).attr("id");
        }
      }
    });
  }
  else{
    $(".country").each(function(){
      position[0] = loc[0] - $(this).attr("x");
      position[1] = loc[1] - $(this).attr("y");
      var d = Math.sqrt(Math.pow(position[0], 2)+Math.pow(position[1], 2));
      if(mini > d){
        mini = d;
        selectID = $(this).attr("id");
      }
    });
  }
  console.log("selectID:", selectID);
  if(s == 0){
    d3.selectAll(".selected").classed("selected", false);
    $("#"+selectID).attr("class", "country selected");
    $("span.city").html($(".selected").attr("title"));

    $("#events ul").each(function(){
      $(this).hide();
      if($(this).attr("countryID") == selectID) $(this).show();
    });
    $("#eventCountry").text($("#"+selectID).attr("title"));
  }
  return selectID;
}

function plusSlides(){

	$(".overlays-content").empty();
	var arr = disease.split(",");
	var key = arr[0];
	
	var items = [];
	//console.log(diseaseList[key]);
	if(diseaseList[key]){
		items.push("<p>"+key+"</p>" +"<p><strong>傳播方式:\n</strong><li id='" + diseaseList[key] + "'>" + diseaseList[key]["傳播方式"] + "</li>" );
		items.push( "<p> <strong>潛伏期:</strong><li id='" + diseaseList[key]+ "'>" + diseaseList[key].潛伏期+ "</li>" );
		items.push( "<p><strong>發病症狀:</strong><li id='" + diseaseList[key] +  "'>" +  diseaseList[key].發病症狀 + "</li>" );
		items.push( "<p><strong>預防方法:</strong><li id='" + diseaseList[key]+ "'>" +  diseaseList[key].預防方法 + "</li>" );
		items.push( "<p><strong>治療方法與就醫資訊:</strong><li id='" +diseaseList[key] + "'>" +  diseaseList[key].治療方法與就醫資訊 + "</li>" );
	}
	else items.push("<p>資料庫無此疾病</p>")
   $( "<ul/>", {
    "class": "my-new-lists",
    html: items.join( "" )
  }).appendTo( ".overlays-content" );
  

 
  
document.getElementById("myNavs").style.width = "70%";
}