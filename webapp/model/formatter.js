sap.ui.define([], function () {
    "use strict";

    return {        
        formatStyle: function (iValue) {
            if(iValue === ''){
                return " ";
            }
            else if(iValue === '0'){
                return '0';
            }
            else if(iValue === '100'){
                return '100'
            }
            
        },
        formatRemove: function (iValue) {
            if(iValue === undefined){
                return true;
            }
            else if(iValue === false){
                return false;
            }            
        },
        formatChange: function (iValue) {
            if(iValue === undefined){
                return true;
            }
            else if(iValue === false){
                return false;
            }            
        },
        
        formatScope: function (iValue) {
            if(iValue === "Public"){
                return sap.m.SharingMode.Public;
            }
            else if(iValue === "Private"){
                return sap.m.SharingMode.Private;
            }            
        },
        formatEnable: function (iValue) {
            if(iValue === undefined){
                return true;
            }
            else if(iValue === false){
                return false;
            }            
        }
    }  
});