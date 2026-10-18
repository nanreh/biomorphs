/*
Copyright © 2009 Hernan Silberman <hernan@defy.org>
This work is free. You can redistribute it and/or modify it under the
terms of the Do What The Fuck You Want To Public License, Version 2,
as published by Sam Hocevar. See http://www.wtfpl.net/ for more details.
*/

import './index.css';

var biomorphs = function() {

    // private data.
    var treeDepth = 0;

    var N = 0;
    var NE = 1;
    var E = 2;
    var SE = 3;
    var S = 4;
    var SW = 5;
    var W = 6;
    var NW = 7;

    // Biomorphs are drawn in a square of this size, which is then scaled to fit the canvas. The
    // longest segment is a fixed fraction of it, and the genes are reduced modulo that length, so a
    // given genome draws the same shape at any canvas size. 300 keeps the shapes the app has always
    // drawn, from when every canvas was the default 300 pixels wide.
    var DRAWING_SIZE = 300;
    var maxSegmentLen = Math.floor(DRAWING_SIZE / 2 / 8);

    // Each biomorph is centered in its canvas and drawn this many times larger, unless that would
    // not fit, so most of them fill a good part of the canvas while sizes still compare fairly.
    // At 2, about the biggest 15% are shrunk to fit. 1 keeps them their natural size.
    var ZOOM = 2;
    // the share of the canvas a biomorph can fill
    var FILL = 0.9;

    // Map x -> x1
    var dx = [];
    dx[N] = 0;
    dx[NE] = 1;
    dx[E] = 1;
    dx[SE] = 1;
    dx[S] = 0;
    dx[SW] = -1;
    dx[W] = -1;
    dx[NW] = -1;

    // Map y -> y1
    var dy = [];
    dy[N] = -1;
    dy[NE] = -1;
    dy[E] = 0;
    dy[SE] = 1;
    dy[S] = 1;
    dy[SW] = 1;
    dy[W] = 0;
    dy[NW] = -1;



    /**
     * Convenience function returning a random gene value in range(0,20).
     */
    function rand() {
        return Math.floor(Math.random()*21);
    }

    /**
     * This function returns a copy of the provided array of genes with a
     * single gene mutation.
     */
    function mutateGenes( genes ) {

        // select a gene to mutate.
        var gene = Math.floor(Math.random() * genes.length);

        var result = genes.slice(0);

        // Mutate the gene, either gene-=1 or gene+=1 with equal odds
        if( Math.random() < 0.5 ) {
            result[gene] = result[gene] - 1;
            if( result[gene] < 0 ) {
                result[gene] = 20;
            }
        } else {
            result[gene] = result[gene] + 1;
            if( result[gene] > 20 ) {
                result[gene] = 0;
            }
        }

        return result;
    }


    /**
     * Builds a Biomorph.  Each Biomorph is associated with a canvas element.
     */
    function biomorph( canvasElt ) {

        var canvas = canvasElt;

        var genes = [];

        /**
         * Sizes the canvas's drawing surface to the size it is shown at, times the screen's pixel
         * density, so drawings are neither stretched by CSS nor blurry on high density screens.
         * Then scales the DRAWING_SIZE square to fit the canvas, centered, so drawing is done in
         * that square's coordinates. Resizing the surface also clears it.
         */
        function fitToDisplay() {
            var ratio = window.devicePixelRatio || 1;
            canvas.width = Math.round( canvas.clientWidth * ratio );
            canvas.height = Math.round( canvas.clientHeight * ratio );
            var scale = Math.min( canvas.width, canvas.height ) / DRAWING_SIZE;
            canvas.getContext('2d').setTransform( scale, 0, 0, scale,
                ( canvas.width - DRAWING_SIZE * scale ) / 2,
                ( canvas.height - DRAWING_SIZE * scale ) / 2 );
        }

        function setGenes( newgenes ) {
            genes = newgenes;
            draw();
        }
        function getGenes() {
            return genes;
        }

        function setSelected( val ) {
            if( val ) {
                canvasElt.className += ' selected';
            } else {
                canvasElt.className = canvasElt.className.replace(/ selected/, '');
            }
        }

        canvasElt.onmouseover = function() {
            setSelected(true);
        };

        canvasElt.onmouseout = function() {
            setSelected(false);
        };

        // Redraw when the canvas changes size, e.g. when the window is resized or a phone is
        // turned, since the drawing surface is sized to it.
        new ResizeObserver( function() {
            draw();
        }).observe( canvasElt );

            


        /**
         * Replaces the genome of this Biomorph with a new genome chosen at random.
         */
        function randomize() {

            var newgenes = [];
            newgenes[0] = rand();  // depth
            newgenes[1] = rand();  // x-scale levels 3, 6, 9
            newgenes[2] = rand();  // x-scale levels 1, 4, 7
            newgenes[3] = rand();  // x-scale levels 2, 5, 8
            newgenes[4] = rand();  // y-scale levels 3, 6, 9
            newgenes[5] = rand();  // y-scale levels 1, 4, 7
            newgenes[6] = rand();  // y-scale levels 2, 5, 8
            newgenes[7] = rand();  // red
            newgenes[8] = rand();  // green
            newgenes[9] = rand();  // blue
            newgenes[10] = rand(); // width
            setGenes( newgenes );
        }

        function draw() {

            if( genes.length === 0 ) {
                return;
            }

            fitToDisplay();
            var ctx = canvas.getContext('2d');

            var x = DRAWING_SIZE / 2;
            var y = DRAWING_SIZE / 2;

            treeDepth = genes[0] % 9 + 1;  // min depth=1, max depth is 10
            
            var initTreeGrowthDirection = N;

            // Measure the tree first, to center it and zoom in on it.
            var left = x, top = y, right = x, bottom = y;
            growTree( x, y, treeDepth, initTreeGrowthDirection, function( x, y, i, j ) {
                left = Math.min( left, i );
                top = Math.min( top, j );
                right = Math.max( right, i );
                bottom = Math.max( bottom, j );
            });
            var zoom = Math.min( ZOOM, DRAWING_SIZE * FILL / Math.max( right - left, bottom - top, 1 ) );
            ctx.translate( DRAWING_SIZE / 2, DRAWING_SIZE / 2 );
            ctx.scale( zoom, zoom );
            ctx.translate( -( left + right ) / 2, -( top + bottom ) / 2 );

            growTree( x, y, treeDepth, initTreeGrowthDirection, function( x, y, i, j, treeDepth ) {
                drawSegment( ctx, x, y, i, j, treeDepth );
            });
        }

        /**
         * Walks the tree, calling visit( x, y, i, j, treeDepth ) for each segment, from (x, y) to
         * (i, j), in drawing order.
         */
        function growTree( x, y, treeDepth, treeGrowthDirection, visit ) {

            if( treeGrowthDirection < 0 ) {
                treeGrowthDirection += 8;
            }
            else if( treeGrowthDirection > 7 ) {
                treeGrowthDirection -= 8;
            }
            
            var xoffset = dx[treeGrowthDirection];
            var yoffset = dy[treeGrowthDirection];
            
            var xGene = (treeDepth % 3) + 1;
            var yGene = xGene + 3;
            
            var i = x + Math.floor( xoffset*( genes[xGene] * 2579 ) % maxSegmentLen );
            var j = y + Math.floor( yoffset*( genes[yGene] * 5051 ) % maxSegmentLen );

            visit( x, y, i, j, treeDepth );

            if( treeDepth <= 0 ) {
                return;
            }

            // Grow the left and right subtrees recursively.
            growTree( i, j, treeDepth-1, treeGrowthDirection+1, visit );
            growTree( i, j, treeDepth-1, treeGrowthDirection-1, visit );
        }

        function drawSegment( ctx, x, y, i, j, treeDepth ) {

            var rscale = Math.floor( genes[7] * 577) % 255;
            var gscale = Math.floor( genes[8] * 1297) % 255;
            var bscale = Math.floor( genes[9] * 2089) % 255;
            
            var r = (rscale + treeDepth * 97) % 255;
            var g = (gscale + treeDepth * 97) % 255;
            var b = (bscale + treeDepth * 97) % 255;
            
            var color = 'rgba('+r+','+g+','+b+',.7)';
            
            var width = Math.abs( genes[10]*treeDepth ) % 5 + 1;
            
            ctx.beginPath();
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.strokeStyle = color;
            ctx.lineJoin = 'round';
            ctx.moveTo( x, y );
            ctx.lineTo( i, j );
            ctx.closePath();
            ctx.stroke();
        }
        
        return {
            randomize : randomize,
            getGenes : getGenes,
            setGenes : setGenes,
            draw : draw
        };
    }


    /**
     * Creates a child biomorph.  A child Biomorph has a reference to the parent Biomorph.
     * Clicking on it promotes it to be the parent.
     */
    function makeChild( canvasElt, parent ) {
        
        var result = biomorph( canvasElt );
        var myParent = parent;

        canvasElt.onclick = function() {
            myParent.setGenes( result.getGenes() );
        };

        return result;
    }

    /**
     * Creates the parent Biomorph.  The parent has a reference to each of its children.
     * Clicking on it replaces the children with new children which are mutated copies
     * of the parent.
     */
    function makeParent( canvasElt ) {

        var result = biomorph( canvasElt );

        var superSetGenes = result.setGenes;

        var myChildren = [];

        function setChildren( children ) {
            myChildren = children;
        }

        function updateChildren() {
            for( var i=0; i<myChildren.length; i++ ) {
                myChildren[i].setGenes( mutateGenes( result.getGenes() ) );
            }
        }

        function setGenes( newgenes ) {
            superSetGenes( newgenes );
            updateChildren();
        }


        var superRandomize = result.randomize;

        function randomize() {
            superRandomize();
            updateChildren();
        }

        canvasElt.onclick = function() {
            updateChildren();
        };

        result.setGenes = setGenes;
        result.setChildren = setChildren;
        result.randomize = randomize;

        return result;
    }

    /**
     * Builds the Biomorph application.
     */
    function init() {

        // Build the parent.
        var parentElt = document.getElementsByClassName("parent")[0];
        var parent = makeParent( parentElt );

        // Build the children.
        var children = [];
        var childElts = document.getElementsByClassName("child");
        for(var i=0; i<childElts.length; i++) {

            var currChildElt = childElts[i];
            var currChild = makeChild( childElts[i], parent );
            children.push( currChild );
        }

        parent.setChildren( children );
        parent.randomize();
        parent.draw();

        // Initialize the random button.
        var randomBtn = document.getElementById("randomBtn");
        randomBtn.onclick = function() {
            parent.randomize();
            parent.draw();
        };

    }

    return {
        init : init
    };

}();

function ready(fn) {
  if (document.readyState != 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}
ready(function() {
    biomorphs.init();
})
