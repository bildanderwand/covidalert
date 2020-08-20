// config plotly
let config = {
	displaylogo: true,
	toImageButtonOptions: {
		format: 'png', // one of png, svg, jpeg, webp
		filename: 'grafik',
		height:  650,
		width: 780,
		scale: 1 // Multiply title/legend/axis/canvas sizes by this factor
	},
	locale: 'de',
	responsive: true,
  displayModeBar: false
};

// thanks to https://stackoverflow.com/questions/4413590/javascript-get-array-of-dates-between-2-dates
Date.prototype.addDays = function(days) {
    let date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
}

function getDates(startDate, stopDate) {
    let dateO = [];
    let currentDate = startDate;
    let currentDatenum = Math.round(Number(startDate)/(24*60*60*1000));
    while (currentDate <= stopDate) {
        let newDat = {Datum: currentDate, numdate: currentDatenum};
        dateO = dateO.concat(newDat);
        currentDate = currentDate.addDays(1);
        currentDatenum = currentDatenum + 1;
    }
    return dateO;
}

// two digits fun
function twoDigits(x){
  if(x === null){
    return NaN;
  } else {
    return x.toFixed(2);
  }
}

// percent fun
function percentFun(x){
  if(x === null){
    return NaN;
  } else {
    if(x > 0){
      return '+' + (x*100).toFixed(1) + '%';
    } else {
      return (x*100).toFixed(1) + '%';
    }
  }
}

const kt = ['AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE', 'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH', 'FL'];

let ktPop = { // Data from BFS https://www.bfs.admin.ch/bfs/de/home/statistiken/bevoelkerung.assetdetail.13007515.html as of first Quarter 2020
  'CH': 8619259,
  'AG': 687491,
  'AI': 16136,
  'AR': 55388,
  'BE': 1040412,
  'BL': 289534,
  'BS': 196386,
  'FR': 322658,
  'GE': 504205,
  'GL': 40713,
  'GR': 198787,
  'JU': 73490,
  'LU': 414364,
  'NE': 176340,
  'NW': 43039,
  'OW': 37906,
  'SG': 511811,
  'SH': 82454,
  'SO': 275661,
  'SZ': 160289,
  'TG': 280068,
  'TI': 350887,
  'UR': 36732,
  'VD': 808652,
  'VS': 345875,
  'ZG': 127387,
  'ZH': 1542594,
  'FL': 38650
}



// here we get the full csv from openZH
let dat = d3.csv('https://raw.githubusercontent.com/openZH/covid_19/master/COVID19_Fallzahlen_CH_total_v2.csv', function(d) {
  return {
    Datum: new Date(d.date),
    numdate: Math.round(Number(new Date(d.date))/(24*60*60*1000)), // easier to calc floating cum cases
    kt: d.abbreviation_canton_and_fl,
    cumcasesTot: d.ncumul_conf
  };
}).then(function(d) { // since D3 V5, this gives only a promise, therefor always use with .then()
    return d.filter(d => d['cumcasesTot'] !== ''); // this is sometimes empty...
});

// now calculate for each canton the cumulative cases for the last 7 days (count empty as 0)
let ktObj = {};
ktObj = dat.then(function(d) {

  // absolutely all dates
  let minDateall = d3.min(d, d => d.Datum);
  let maxDateall = d3.max(d, d => d.Datum);

  dataend = kt.map(g => {
    let subdat = d.filter(r => r['kt'] === g);

    let allDates = getDates(minDateall, maxDateall);
    // max Date per Kanton to set to null if NA
    let maxDate = d3.max(subdat, d => d.numdate);

    // new cases
    for (let i=0; i<subdat.length; i++) {
      if(i === 0){
  			subdat[i]['newcases'] = (subdat[i]['cumcasesTot']-0);
  		} else {
  			subdat[i]['newcases'] = (subdat[i]['cumcasesTot']-subdat[i-1]['cumcasesTot']);
  		}
    }

    // we map all values to the date array for that we have all dates

    for (let i = 0; i<allDates.length; i++) {
      // map to allDates, make 0 if not existent before last data delivery date, else null
      let currentrow = subdat.filter(sd => sd['numdate'] === allDates[i]['numdate']);
      if (currentrow.length === 0){
        allDates[i]['newcases'] = 0;
        allDates[i]['kt'] = g;
      } else {
        allDates[i] = {...allDates[i], ...currentrow[0]}
      }

      // cumulative cases of the last 7 days
      let sub7 = allDates.filter(sd => sd['numdate'] > allDates[i]['numdate']-7 && sd['numdate'] <= allDates[i]['numdate']);
      if(sub7.length > 7){
     		alert('Mehr als 7 Tage....');
     		let e = new Error('Etwas passt gar nicht (7 Tage).');
     		throw e;
   	 }
     allDates[i]['cumcases7'] = d3.sum(sub7, d => d.newcases);

     // 7d incidence
     allDates[i]['inc7d'] = allDates[i]['cumcases7']/ktPop[g]*100000

     // change in 7d incidence to week before (identical as change in cumcases7)
     if(i > 6){
       allDates[i]['inc7dChange'] = (allDates[i]['cumcases7']-allDates[i-7]['cumcases7'])/allDates[i-7]['cumcases7'];
     }

     // alarmlevel
     if (allDates[i]['inc7d'] <= 10) {
       allDates[i]['alarmlevel'] = 'Grün';
       allDates[i]['alarmcolor'] = 'green';
       allDates[i]['alarmnumb'] = 0;
     } else if (allDates[i]['inc7d'] <= 25) {
       if(allDates[i]['inc7dChange'] > 0.2) { // bigger or equal or bigger is not clear in text, I always make bigger
         allDates[i]['alarmlevel'] = 'Orange';
         allDates[i]['alarmcolor'] = 'orange';
         allDates[i]['alarmnumb'] = 0.5;
       } else if (allDates[i]['inc7dChange'] > 0.10) {
         allDates[i]['alarmlevel'] = 'Gelb';
         allDates[i]['alarmcolor'] = 'yellow';
         allDates[i]['alarmnumb'] = 0.25;
       } else {
         allDates[i]['alarmlevel'] = 'Grün';
         allDates[i]['alarmcolor'] = 'green';
         allDates[i]['alarmnumb'] = 0;
       }
     } else if (allDates[i]['inc7d'] <= 50) {
       if(allDates[i]['inc7dChange'] > 0.2) {
         allDates[i]['alarmlevel'] = 'Rot';
         allDates[i]['alarmcolor'] = 'pink';
         allDates[i]['alarmnumb'] = 0.75;
       } else if (allDates[i]['inc7dChange'] > 0.10) {
         allDates[i]['alarmlevel'] = 'Orange';
         allDates[i]['alarmcolor'] = 'orange';
         allDates[i]['alarmnumb'] = 0.5;
       } else if (allDates[i]['inc7dChange'] > 0) {
         allDates[i]['alarmlevel'] = 'Gelb';
         allDates[i]['alarmcolor'] = 'yellow';
         allDates[i]['alarmnumb'] = 0.25;
       } else {
         allDates[i]['alarmlevel'] = 'Grün';
         allDates[i]['alarmcolor'] = 'green';
         allDates[i]['alarmnumb'] = 0;
       }
     } else if (allDates[i]['inc7d'] <= 75) {
       if (allDates[i]['inc7dChange'] > 0.10) {
         allDates[i]['alarmlevel'] = 'Rot';
         allDates[i]['alarmcolor'] = 'pink';
         allDates[i]['alarmnumb'] = 0.75;
       } else if (allDates[i]['inc7dChange'] > 0) {
         allDates[i]['alarmlevel'] = 'Orange';
         allDates[i]['alarmcolor'] = 'orange';
         allDates[i]['alarmnumb'] = 0.5;
       } else {
         allDates[i]['alarmlevel'] = 'Gelb';
         allDates[i]['alarmcolor'] = 'yellow';
         allDates[i]['alarmnumb'] = 0.25;
       }
     } else {
       if(allDates[i]['inc7dChange'] > 0.2) {
         allDates[i]['alarmlevel'] = 'Rot';
         allDates[i]['alarmcolor'] = 'red';
         allDates[i]['alarmnumb'] = 1;
       } else if (allDates[i]['inc7dChange'] > 0) {
         allDates[i]['alarmlevel'] = 'Rot';
         allDates[i]['alarmcolor'] = 'pink';
         allDates[i]['alarmnumb'] = 0.75;
       } else {
         allDates[i]['alarmlevel'] = 'Orange';
         allDates[i]['alarmcolor'] = 'orange';
         allDates[i]['alarmnumb'] = 0.5;
       }
     }

     // wenn das i über dem maxdatum -> alle relevanten Variablen = null
     if(allDates[i]['numdate'] > maxDate) {
       allDates[i]['newcases'] = null;
       allDates[i]['cumcases7'] = null;
       allDates[i]['inc7d'] = null;
       allDates[i]['inc7dChange'] = null;
       allDates[i]['alarmlevel'] = null;
       allDates[i]['alarmcolor'] = null;
       allDates[i]['alarmnumb'] = null;
     }

    };

    return allDates;
  });


	// arrays for plot
  // alarmnumbs
  let zarr = dataend.map(g =>
      g.map(f => f.alarmnumb)
    );
  // kantons
  let karr = dataend.map(g =>
      g[1].kt
    );
  // dates
  let darr = dataend[1].map(d => d.Datum);
  // hovertext
  let text = dataend.map(g =>
      g.map(f => {
return `
Datum: ${moment(f.Datum).format('D.M.YYYY')}<br>
Kanton: ${f.kt}<br>
Neue Fälle: ${f.newcases}<br>
Fälle letzte 7 Tage: ${f.cumcases7}<br>
7-Tageinzidenz auf 100'000: ${twoDigits(f.inc7d)} <br>
Veränderung zu Vorwoche: ${percentFun(f.inc7dChange)}<br>
Alarmstufe: ${f.alarmlevel}
`
        })
    );

	// the plot
  let colorscaleValue = [
    [0, 'green'],
    [0.25, 'yellow'],
    [0.5, 'orange'],
    [0.75, '#ff0066'],
    [1, '#ff0000'],
  ];

  let data = [
    {
      z: zarr,
      x: darr,
      y: karr,
      type: 'heatmap',
      colorscale: colorscaleValue,
      text: text,
      hoverinfo: 'text',
      hoverongaps: false,
      showscale: false
    }
  ];

  let layout = {
    margin: {
      t: 10,
      r: 10,
      b: 50,
      l: 50
    },
    yaxis: {
    	showgrid: false
		},
    hoverlabel: {
        bgcolor:'black',
    }
  };

  Plotly.newPlot('myDiv', data, layout = layout, config);

  return dataend;
});
