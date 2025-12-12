sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../model/formatter",
    'sap/ui/core/Fragment'
], (Controller, JSONModel, MessageToast, MessageBox, Filter,
    FilterOperator, formatter, Fragment) => {
    "use strict";
    var that;
    return Controller.extend("vcp.vcplannerdashboard.controller.View1", {
        formatter: formatter,
        onInit: function () {
            this.oModel = this.getOwnerComponent().getModel();
            var sRootPath = jQuery.sap.getModulePath("vcp/vcplannerdashboard", "/");
            this.byId("idHeaderImage").setSrc(sRootPath + "image/logo.png");
            this.getLocationData();
            this.getIBPCalendarWeek();
            this.getView().setModel(new sap.ui.model.json.JSONModel({ items12: [] }), "viewDetails");
        },
        onAfterRendering: async function () {
            that = this;
            that.oGModel = that.getOwnerComponent().getModel("oGModel");
            sap.ui.core.BusyIndicator.show();
            that.viewDetails = new JSONModel();
            that.viewDetails.setSizeLimit(5000);
            that.variantModel = new JSONModel();
            that.variantModel.setSizeLimit(5000);
            this.data = [];
            this.locationData = [];
            this.prodData = [];
            that.newChartData = [];
            that.CalendarData = [], that.assemblyData = [], that.cardData = [], that.noAssemblyData = [],
                that.totalAssemblyData = [], that.forecastData = [], that.totalOptMixData = [], that.monthData = [];
            that.rtrLineData = [], that.prdDmdData = [], that.wowData = [], that._aSelectedWidgets = [];
            that.oGModel.setProperty("/showPivot", false);
            that.oGModel.setProperty("/tableType", 'Table');
            that.staticColumns = ["Assembly", "Lag Month"];
            that.loadFragments();
            this.getLocProd();
            that.getAssemblyDesc();
            await this.loadAlertsCards();
            this.getVariantData();
        },
        loadFragments: function () {
            that.oHBox = new sap.m.HBox({
                alignItems: "Center",
                items: [
                    // that.oCheckBox,
                    new sap.m.Title({
                        text: "Select All",
                        titleStyle: "Auto"
                    })
                ]
            });
            if (!that.keyFrag) {
                that.keyFrag = sap.ui.xmlfragment("vcp.vcplannerdashboard.fragments.keyFigure", that);
                that.getView().addDependent(that.keyFrag);
            }
        },
        getLocationData: async function () {
            const iPageSize = 5000; // tune this depending on your service
            let iSkip = 0;
            let aAllResults = [];
            let bHasMore = true;
            while (bHasMore) {
                const aContexts = await this.oModel
                    .bindList("/getLocation")
                    .requestContexts(iSkip, iPageSize);
                const aPageResults = aContexts.map(ctx => ctx.getObject());
                aAllResults = aAllResults.concat(aPageResults);
                // If we got less than requested, it's the last page
                if (aPageResults.length < iPageSize) {
                    bHasMore = false;
                } else {
                    iSkip += iPageSize;
                }
            }
            console.log("Total records loaded:", aAllResults.length);
            if (aAllResults.length === 0) {
                sap.m.MessageToast.show("No data available for all Locations");
            } else {
                that.oGModel.setProperty("/fullLocData", aAllResults);
            }
        },
        getAssemblyDesc: async function () {
            const iPageSize = 5000; // tune this depending on your service
            let iSkip = 0;
            let aAllResults = [];
            let bHasMore = true;
            while (bHasMore) {
                const aContexts = await this.oModel
                    .bindList("/getAssemblyDesc")
                    .requestContexts(iSkip, iPageSize);
                const aPageResults = aContexts.map(ctx => ctx.getObject());
                aAllResults = aAllResults.concat(aPageResults);
                // If we got less than requested, it's the last page
                if (aPageResults.length < iPageSize) {
                    bHasMore = false;
                } else {
                    iSkip += iPageSize;
                }
            }
            console.log("Total records loaded:", aAllResults.length);
            if (aAllResults.length === 0) {
                sap.m.MessageToast.show("No assembly data available for all Locations");
            } else {
                that.oGModel.setProperty("/fullAssemblyData", aAllResults);
            }
        },
        getIBPCalendarWeek: async function () {
            const iPageSize = 5000; // tune this depending on your service
            let iSkip = 0;
            let aAllResults = [];
            let bHasMore = true;
            const oFilter = new sap.ui.model.Filter("LEVEL", sap.ui.model.FilterOperator.EQ, "M");
            while (bHasMore) {
                const aContexts = await this.oModel
                    .bindList("/getIBPCalenderWeek", null, null, [oFilter])
                    .requestContexts(iSkip, iPageSize);
                const aPageResults = aContexts.map(ctx => ctx.getObject());
                aAllResults = aAllResults.concat(aPageResults);
                // If we got less than requested, it's the last page
                if (aPageResults.length < iPageSize) {
                    bHasMore = false;
                } else {
                    iSkip += iPageSize;
                }
            }
            console.log("Total records loaded:", aAllResults.length);
            if (aAllResults.length === 0) {
                sap.m.MessageToast.show("No data available for all Locations");
            } else {
                that.oGModel.setProperty("/CalendarData", aAllResults);
            }
        },
        // v4 oData
        getLocProd: async function () {
            const iPageSize = 5000; // tune this depending on your service
            let iSkip = 0;
            let aAllResults = [];
            let bHasMore = true;
            while (bHasMore) {
                const aContexts = await this.oModel
                    .bindList("/getfactorylocdesc")
                    .requestContexts(iSkip, iPageSize);
                const aPageResults = aContexts.map(ctx => ctx.getObject());
                aAllResults = aAllResults.concat(aPageResults);
                // If we got less than requested, it's the last page
                if (aPageResults.length < iPageSize) {
                    bHasMore = false;
                } else {
                    iSkip += iPageSize;
                }
            }
            console.log("Total records loaded:", aAllResults.length);
            if (aAllResults.length === 0) {
                sap.m.MessageToast.show("No data available in demand location and products");
            } else {
                that.oGModel.setProperty("/fullLocProdData", aAllResults);
                this.processData(aAllResults);
                sap.ui.core.BusyIndicator.hide();
            }
        },

        processData: function (results) {
            // Remove duplicates and sort
            this.locationData = this.removeDuplicates(results, "DEMAND_LOC");
            this.locationData.sort((a, b) => a.DEMAND_DESC.localeCompare(b.DEMAND_DESC));
            this.prodData = this.removeDuplicates(results, "PRODUCT_ID");
            this.prodData.sort((a, b) => a.PROD_DESC.localeCompare(b.PROD_DESC));
            // Set models
            const oJSONLoc = new sap.ui.model.json.JSONModel({ results1: this.locationData });
            oJSONLoc.setSizeLimit(5000);   // allow >100 items in binding
            this.getView().setModel(oJSONLoc, "locModel");
            const oJSONProd = new sap.ui.model.json.JSONModel({ results2: this.prodData });
            oJSONProd.setSizeLimit(5000);   // allow >100 items in binding
            this.getView().setModel(oJSONProd, "prodModel");
            // Clear selections
            this.byId("LocationSelect").setSelectedKey("");
            this.byId("productSelect").setSelectedKey("");
        },

        // Remove duplicates based on a specific key
        removeDuplicates: function (data, key) {
            const seen = new Set();
            return data.filter(item => {
                const value = item[key];
                if (seen.has(value)) {
                    return false;
                }
                seen.add(value);
                return true;
            });
        },
        onLocationChange: function () {
            var selectedData = this.byId("LocationSelect").getSelectedKey();
            var filteredProdData = this.prodData.filter(a => a.DEMAND_LOC === selectedData);
            var oJSONProduct = new sap.ui.model.json.JSONModel({ results2: filteredProdData });
            oJSONProduct.setSizeLimit(5000);
            this.getView().setModel(oJSONProduct, "prodModel");
            if (selectedData !== this.oGModel.getProperty("/defaultLocation")) {
                that.byId("idMatListVPD").setModified(true);
            }
        },
        onProductChange: function () {
            var selectedProd = this.byId("productSelect").getSelectedKey();
            if (selectedProd !== this.oGModel.getProperty("/defaultProduct")) {
                that.byId("idMatListVPD").setModified(true);
            }
        },
        onGetData: function () {
            this.loadAlertsCards();
            that.loadAllLags();
            this._loadCharCards();
        },
        onResetData: async function () {
            sap.ui.core.BusyIndicator.show();
            const calendarModelStart = new sap.ui.model.json.JSONModel({ MONTHDATA: [] });
            that.getView().setModel(calendarModelStart, "calendarStart");
            const calendarModelEnd = new sap.ui.model.json.JSONModel({ MONTHDATAEND: [] });
            that.getView().setModel(calendarModelEnd, "calendarEnd");
            const olocModel = new sap.ui.model.json.JSONModel({ Location: [] });
            this.getView().setModel(olocModel, "location");
            this.byId("LocationSelect").setSelectedKey("");
            this.byId("productSelect").setSelectedKey("");
            this.byId("cbFactory").setSelectedKey("");
            this.byId("cbStartMonth").setSelectedKey("");
            this.byId("cbEndMonth").setSelectedKey("");
            that.keySettingData = undefined
            that.oGModel.setProperty("/showPivot", false);
            that.oGModel.setProperty("/tableType", 'Table');
            that.allData = [];
            var existingDiv = document.querySelector('[id*="mainDivLag"]');
            if (existingDiv.children.length > 0) {
                while (existingDiv.firstChild) {
                    existingDiv.removeChild(existingDiv.firstChild);
                }
            }
            that.onFilterResetWOW();
            this.getLocProd();
            await this.loadAlertsCards();
        },

        // Main method to Data alerts using V4 OData
        loadAlertsCards: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel(); // V4 OData model
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();
            // Build filter array for OData V4
            const aFilters = [];
            if (locSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("LOCATION_ID", "EQ", locSelectedKey));
            }
            if (prodSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("PRODUCT_ID", "EQ", prodSelectedKey));
            }
            // Use bindList and requestContexts for V4 OData
            oModel.bindList("/getPlannerAlerts", null, [], aFilters).requestContexts().then(function (aContexts) {
                console.log("[V4 Alerts] Received contexts:", aContexts);
                if (aContexts && aContexts.length > 0) {
                    // Extract data from V4 contexts
                    var rawData = aContexts.map(function (oContext) {
                        return oContext.getObject();
                    });
                    console.log("[V4 Alerts] Raw data:", rawData);
                    // Process the data using your existing logic
                    that._processAlertsDataV4(rawData);
                } else {
                    console.warn("[V4 Alerts] No data received -> show empty cards");
                    sap.ui.core.BusyIndicator.hide();
                    that._setEmptyAlertCards();
                    that.noAssemblyData = [];
                    that.getView().setModel(new sap.ui.model.json.JSONModel([]), "assemblyModel");
                }
            }).catch(function (oError) {
                console.error("[V4 Alerts] Error loading data:", oError);
                sap.ui.core.BusyIndicator.hide();
                that._setEmptyAlertCards();
                that.noAssemblyData = [];
                that.getView().setModel(new sap.ui.model.json.JSONModel([]), "assemblyModel");
            });
        },


        // V4 OData data processing with all three cards
        _processAlertsDataV4: function (oData) {
            var that = this;
            // Normalize incoming V4 payload
            var results = []; try {
                results = Array.isArray(oData) ? oData : (oData.value || []);
            } catch (e) {
                console.error("[V4 Alerts] Error parsing data:", e);
                results = [];
            }
            console.log("[V4 Alerts] raw results length:", results.length);
            if (!results || results.length === 0) {
                console.warn("[V4 Alerts] No alerts -> show empty cards");
                sap.ui.core.BusyIndicator.hide();
                that._setEmptyAlertCards();
                that.noAssemblyData = [];
                that.getView().setModel(new sap.ui.model.json.JSONModel([]), "assemblyModel");
                return;
            }
            // Keep only VCPLANNER alerts
            var vcAlerts = results.filter(function (it) {
                return it && it.APPL === "VCPLANNER";
            });
            if (vcAlerts.length === 0) {
                that._setEmptyAlertCards();
                that.noAssemblyData = [];
                that.getView().setModel(new sap.ui.model.json.JSONModel([]), "assemblyModel");
                return;
            }
            console.log("[V4 Alerts] All VCPLANNER alerts:", vcAlerts);
            // DATA ALERTS: Only MSGGRP = "DATA"
            var dataAlerts = vcAlerts.filter(function (a) {
                return a.MSGGRP === "PROCESS_JOBS";
            });
            // SYSTEM ALERTS: PROCESS_JOBS, INTERFACE, RESTRICTIONS
            var systemAlerts = vcAlerts.filter(function (a) {
                return a.MSGGRP === "PROCESS_JOBS" || a.MSGGRP === "INTERFACE" || a.MSGGRP === "RESTRICTIONS";
            });
            // EXCEPTIONAL ALERTS: Only MSGGRP = "EXCEPTIONAL"
            var exceptionalAlerts = vcAlerts.filter(function (a) {
                return a.MSGGRP === "DATA" || a.MSGGRP === "RESTRICTIONS";
            });
            if (exceptionalAlerts.length > 0) {
                var noAssemblyData = exceptionalAlerts.filter(id => id.MSGID === "S05")[0].MSGTXT;
                that.noAssemblyData = noAssemblyData
                    .match(/'([^']+)'/g)
                    .map(s => {
                        const cleaned = s.replace(/'/g, '')       // remove single quotes
                            .replace(/\(.*\)/, '');  // remove everything from (
                        return { assembly: cleaned.trim() };
                    });
                var assemblyDesc = that.oGModel.getProperty("/fullAssemblyData");
                var assemblies = that.getMergedArray(that.noAssemblyData, assemblyDesc);
                this.getView().setModel(new sap.ui.model.json.JSONModel({ assemblies }), "assemblyModel");
            }
            else {
                that.noAssemblyData = [];
                that.getView().setModel(new sap.ui.model.json.JSONModel([]), "assemblyModel");
            }
            // EXCEPTIONAL ALERTS: Only MSGGRP = "EXCEPTIONAL"
            var interfaceAlerts = vcAlerts.filter(function (a) {
                return a.MSGGRP === "INTERFACE";
            });
            console.log("[V4 Alerts] Filtered - Data:", dataAlerts.length, "System:", systemAlerts.length, "Exception:", exceptionalAlerts.length);
            // Process DATA ALERTS card data - show individual messages
            dataAlerts= sortbyLOGID(dataAlerts);
            var dataAlertsCardData = dataAlerts.map(function (a, idx) {
                return {
                    id: a.PROCESS_ID || a.MSGID || ("data-" + idx),
                    title: a.MSGTXT || "Data alert",
                    description: a.ADDL_INFO || "",
                    // icon: "sap-icon://activities",
                    severity: that._determineExceptionalSeverity(a.MSGTXT)
                };
            });
            
            // Process SYSTEM ALERTS card data - show grouped counts
            var systemGroups = {
                "PROCESS_JOBS": { count: 0, success: 0, warning: 0, error: 0 },
                "INTERFACE": { count: 0, success: 0, warning: 0, error: 0 },
                "RESTRICTIONS": { count: 0, success: 0, warning: 0, error: 0 }
            };
            systemAlerts.forEach(function (a) {
                var group = a.MSGGRP;
                if (systemGroups[group]) {
                    systemGroups[group].count += 1;
                    systemGroups[group].success += Number(a.SUCCESS_COUNT || 0);
                    systemGroups[group].warning += Number(a.WARNING_COUNT || 0);
                    systemGroups[group].error += Number(a.ERROR_COUNT || 0);
                }
            });
            // Convert to array format for the card
            var systemAlertsCardData = Object.keys(systemGroups).map(function (group) {
                var data = systemGroups[group];
                var displayNameMap = {
                    "PROCESS_JOBS": "Process Jobs",
                    "INTERFACE": "Interface",
                    "RESTRICTIONS": "Resource Consumption"
                };
                return {
                    category: displayNameMap[group] || group,
                    count: data.count,
                    success: data.success,
                    warning: data.warning,
                    error: data.error,
                    icon: that._getSystemGroupIcon(group),
                    severity: that._determineSystemSeverity(data.success, data.warning, data.error),
                    rawCategory: group
                };
            }).filter(function (item) {
                return item.count > 0; // Only show groups with alerts
            });
            // Process EXCEPTIONAL ALERTS card data - show individual messages
            exceptionalAlerts= sortbyLOGID(exceptionalAlerts);
            var exceptionalAlertsCardData = exceptionalAlerts.map(function (a, idx) {
                return {
                    id: a.PROCESS_ID || a.MSGID || ("exceptional-" + idx),
                    title: a.MSGTXT || "Exception alert",
                    description: a.ADDL_INFO || "",
                    // icon: "sap-icon://alert",
                    severity: that._determineExceptionalSeverity(a.MSGTXT)
                };
            });
            interfaceAlerts= sortbyLOGID(interfaceAlerts);
            var interfaceAlertsCardData = interfaceAlerts.map(function (a, idx) {
                return {
                    id: a.PROCESS_ID || a.MSGID || ("interface-" + idx),
                    title: a.MSGTXT || "Interface alert",
                    description: a.ADDL_INFO || "",
                    // icon: "sap-icon://connected",
                    severity: that._determineExceptionalSeverity(a.MSGTXT)
                };
            });
            
            console.log("[V4 Alerts] System groups data:", systemAlertsCardData);
            console.log("[V4 Alerts] Exception alerts:", exceptionalAlertsCardData);
            console.log("[V4 Alerts] Interface alerts:", interfaceAlertsCardData);
            // Bind to all three cards
            that._bindAlertsToCardsExact(dataAlertsCardData, systemAlertsCardData, exceptionalAlertsCardData, interfaceAlertsCardData);

            function sortbyLOGID(data) {
                return data.sort((a, b) => {
                    return b.LOG_ID - a.LOG_ID;
                });
            }
        },
        getMergedArray: function (arr1, arr2) {
            const lookup = new Map(arr2.map(a => [a.MAT_CHILD, a.PROD_DESC]));
            // Append desc to array1
            return arr1.map(item => ({
                ...item,
                desc: lookup.get(item.assembly) || null
            }));
        },
        // Binding method for all three cards
        _bindAlertsToCardsExact: function (dataAlertsCardData, systemAlertsCardData, exceptionalAlertsCardData, interfaceAlertsCardData) {
            var that = this;
            // Get card references
            var oSystemCard = that.byId("MyCardId");     // System Alerts (700px)
            var oDataCard = that.byId("MyCardId1");      // Data Alerts (350px)
            var oExceptionalCard = that.byId("MyCardId3"); // Exceptional Alerts (300px)
            var oInterfaceCard = that.byId("MyCardId4")
            try {
                // SYSTEM ALERTS CARD - Grouped counts
                if (oSystemCard) {
                    if (systemAlertsCardData.length === 0) {
                        sap.ui.core.BusyIndicator.hide();
                        that._showEmptyAlertsCard("System Alerts", "MyCardId");
                    } else {
                        oSystemCard.setManifest(
                            that._createSystemAlertsCardManifestExact(systemAlertsCardData)
                        );
                        // ✅ Attach the click event
                        oSystemCard.detachAction(this.onCardAction, this);
                        oSystemCard.attachAction(this.onCardAction, this);
                        console.log("[V4 Alerts] System card bound with", systemAlertsCardData.length, "groups");
                    }
                }

                // DATA ALERTS CARD - Individual messages
                if (oDataCard) {
                    if (dataAlertsCardData.length === 0) {
                        sap.ui.core.BusyIndicator.hide();
                        that._showEmptyAlertsCard("Data Alerts", "MyCardId1");
                    } else {
                        oDataCard.setManifest(
                            that._createDataAlertsCardManifestExact(dataAlertsCardData)
                        );
                        console.log("[V4 Alerts] Data card bound with", dataAlertsCardData.length, "alerts");
                    }
                }

                // EXCEPTIONAL ALERTS CARD - Individual messages with severity
                if (oExceptionalCard) {
                    if (exceptionalAlertsCardData.length === 0) {
                        that._showEmptyAlertsCard("Exception Alerts", "MyCardId3");
                    } else {
                        oExceptionalCard.setManifest(
                            that._createExceptionalAlertsCardManifest(exceptionalAlertsCardData)
                        );
                        console.log("[V4 Alerts] Exception card bound with", exceptionalAlertsCardData.length, "alerts");
                    }
                }

                // INTERFACE ALERTS CARD - Individual messages 
                if (oInterfaceCard) {
                    if (interfaceAlertsCardData.length === 0) {
                        that._showEmptyAlertsCard("Interface Alerts", "MyCardId4");
                    } else {
                        oInterfaceCard.setManifest(
                            that._createInterfaceAlertsCardManifest(interfaceAlertsCardData)
                        );
                        console.log("[V4 Alerts] Exception card bound with", interfaceAlertsCardData.length, "alerts");
                    }
                }
                console.log("[V4 Alerts] All three cards updated successfully");
                sap.ui.core.BusyIndicator.hide();
            } catch (error) {
                console.error("[V4 Alerts] Error binding cards:", error);
                that._setEmptyAlertCards();
                that.noAssemblyData = [];
                that.getView().setModel(new sap.ui.model.json.JSONModel([]), "assemblyModel");
                sap.ui.core.BusyIndicator.hide();
            }
        },

        // SYSTEM ALERTS CARD - Show grouped counts in exact format
        _createSystemAlertsCardManifestExact: function (data) {
            var safeData = data || [];
            data.forEach(item => {
                if (item.error > 0) item.state = "Error";
                else if (item.warning > 0) item.state = "Warning";
                else item.state = "Success";
                // item.targetApp = await this._getTargetForCategory(item.category);
                item.targetApp = item.category;
            });
            return {
                "sap.app": {
                    "id": "vcp.v4card.systemalerts",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": { "technology": "UI5" },
                "sap.card": {
                    "type": "List",
                    "data": {
                        "json": {
                            "items": safeData
                        }
                    },
                    "header": {
                        "title": "System Alerts",
                        "subTitle": "Process, Interface & Resource Consumption Status",
                        "icon": {
                            "src": "sap-icon://process"
                        },
                        "status": {
                            "text": "",
                            "state": "{= ${error} > 0 ? 'Error' : ${warning} > 0 ? 'Warning' : 'Success' }"
                        }
                    },
                    "content": {
                        "data": {
                            "path": "/items"
                        },
                        "item": {
                            "title": "{category}",
                            "description": "{count} alert(s)",
                            "highlight": "{severity}",
                            "icon": { "src": "{icon}" },
                            "info": {
                                "value": "✅ {success} ⚠ {warning} ❌ {error}",
                                "state": "{= ${error} > 0 ? 'Error' : ${warning} > 0 ? 'Warning' : 'Success' }",

                            },

                            "actions": [
                                {
                                    "type": "Custom",
                                    "parameters": {
                                        "actionId": "{rawCategory}"
                                    }
                                }
                            ]
                        }
                    }
                }
            };
        },

        // DATA ALERTS CARD - Show individual messages
        _createDataAlertsCardManifestExact: function (data) {
            var safeData = data || [];
            return {
                "sap.app": {
                    "id": "vcp.v4card.dataalerts",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": { "technology": "UI5" },
                "sap.card": {
                    "type": "List",
                    "data": {
                        "json": {
                            "items": safeData
                        }
                    },
                    "header": {
                        "title": "Data Alerts",
                        "subTitle": "Issues in VC Planner data processing",
                        "icon": {
                            "src": "sap-icon://activities",
                            "width": "70px"
                        },
                        "status": {
                            "text": safeData.length + " alerts",
                            "state": safeData.length > 0 ? "Warning" : "Success"
                        }
                    },
                    "content": {
                        "data": {
                            "path": "/items"
                        },
                        "item": {
                            "title": "{title}",
                            "description": "{description}",
                            // "icon": { "src": "{icon}" }
                            "highlight": "{severity}"
                        }
                    },
                    "footer": {
                        "paginator": {
                            "pageSize": 6
                        }
                    }
                }
            };
        },

        // EXCEPTIONAL ALERTS CARD - Show individual messages with severity
        _createExceptionalAlertsCardManifest: function (data) {
            var safeData = data || [];
            return {
                "sap.app": {
                    "id": "vcp.v4card.exceptionalalerts",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": { "technology": "UI5" },
                "sap.card": {
                    "type": "List",
                    "data": {
                        "json": {
                            "items": safeData
                        }
                    },
                    "header": {
                        "title": "Exception Alerts",
                        "subTitle": "Critical exceptions",
                        "icon": {
                            "src": "sap-icon://critical-issue"
                        },
                        "status": {
                            "text": safeData.length + " alerts",
                            // "state": safeData.length > 0 ? "Error" : "Success"
                        }
                    },
                    "content": {
                        "data": {
                            "path": "/items"
                        },
                        "item": {
                            "title": "{title}",
                            "description": "{description}",
                            "highlight": "{severity}",
                            "displayStyle": "standard"
                        }
                    },
                    "footer": {
                        "paginator": {
                            "pageSize": 6
                        }
                    }
                }
            };
        },

        // INTERFACE ALERTS CARD - Show individual messages 
        _createInterfaceAlertsCardManifest: function (data) {
            var safeData = data || [];
            return {
                "sap.app": {
                    "id": "vcp.v4card.exceptionalalerts",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": { "technology": "UI5" },
                "sap.card": {
                    "type": "List",
                    "data": {
                        "json": {
                            "items": safeData
                        }
                    },
                    "header": {
                        "title": "Interface Alerts",
                        "subTitle": "Interface system Alerts",
                        "icon": {
                            "src": "sap-icon://connected"
                        },
                        "status": {
                            "text": safeData.length + " alerts",
                        }
                    },
                    "content": {
                        "data": {
                            "path": "/items"
                        },
                        "item": {
                            "title": "{title}",
                            "description": "{description}",
                            "highlight": "{severity}"
                        }
                    },
                    "footer": {
                        "paginator": {
                            "pageSize": 6
                        }
                    }
                }
            };
        },

        // Determine severity for exceptional alerts
        _determineExceptionalSeverity: function (message) {
            if (!message) return "Information";
            var lowerMessage = message.toLowerCase();
            if (lowerMessage.includes('error') || lowerMessage.includes('failed') ||
                lowerMessage.includes('critical') || lowerMessage.includes('fatal') ||
                lowerMessage.includes("no planning") || lowerMessage.includes("insufficient") || lowerMessage.includes("no content")) {
                return "Error";
            } else if (lowerMessage.includes('warning') || lowerMessage.includes('timeout')) {
                return "Warning";
            }
            else if (lowerMessage.includes('success') || lowerMessage.includes('good')
                || lowerMessage.includes('yes')) {
                return "Success";
            }
            return "Information";
        },

        // Determine severity for system alerts
        _determineSystemSeverity: function (success, warnings, errors) {
            if (errors > 0) {
                return "Error";
            } else if (warnings > 0 && errors === 0) {
                return "Warning";
            }
            else if (success > 0) {
                return "Success";
            }
            return "Information";
        },


        // System group icons
        _getSystemGroupIcon: function (group) {
            var iconMap = {
                "PROCESS_JOBS": "sap-icon://activities",
                "INTERFACE": "sap-icon://connected",
                "RESTRICTIONS": "sap-icon://limitation"
            };
            return iconMap[group] || "sap-icon://message-warning";
        },

        // Updated empty cards method for all three cards
        _setEmptyAlertCards: function () {
            var that = this;
            var oSystemCard = that.byId("MyCardId");
            var oDataCard = that.byId("MyCardId1");
            var oExceptionalCard = that.byId("MyCardId3");
            var oInterfaceCard = that.byId("MyCardId4");
            if (oSystemCard) that._showEmptyAlertsCard("System Alerts", "MyCardId");
            if (oDataCard) that._showEmptyAlertsCard("Data Alerts", "MyCardId1");
            if (oExceptionalCard) that._showEmptyAlertsCard("Exception Alerts", "MyCardId3");
            if (oInterfaceCard) that._showEmptyAlertsCard("Interface Alerts", "MyCardId4");
        },

        _showEmptyAlertsCard: function (title, id) {
            var that = this;
            var oEmptyManifest = {
                "sap.app": {
                    "id": "vcp.v4card." + title.toLowerCase().replace(/\s/g, '') + ".empty",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": {
                    "technology": "UI5",
                    "deviceTypes": { "desktop": true, "tablet": true, "phone": true }
                },
                "sap.card": {
                    "type": "List",
                    "data": {
                        "json": {
                            "items": [{

                            }]
                        }
                    },
                    "header": {
                        "title": title,
                        "subTitle": "No active " + title + " found"
                    },
                    "content": {
                        "data": {
                            "path": "/items"
                        },
                        "item": {
                            "title": "{title}",
                            "description": "{description}"
                            // "icon": { "src": "{icon}" }
                        }
                    }
                }
            };
            var oCard = that.byId(id);
            if (oCard) {
                oCard.setManifest(oEmptyManifest);
                console.log("[V4 Alerts] Empty card set for:", title);
            }
        },
        getUser: function () {
            let vUser;
            if (sap.ushell && sap.ushell.Container) {
                let email = sap.ushell.Container.getService("UserInfo")
                    .getUser()
                    .getEmail();
                vUser = email ? email : "";
            }
            return vUser;
        },
        onCardAction: async function (oEvent) {
            const oParams = oEvent.getParameters();
            const oAction = oParams.action || {}; // fallback
            const actionParams = oAction.parameters || oParams.parameters || {}; // safe fallback
            const actionId = actionParams.actionId;
            console.log("Card action triggered:", actionId);
            switch (actionId) {
                case "PROCESS_JOBS":
                    await this._navigateToProcessJobs();
                    break;
                case "INTERFACE":
                    await this._navigateToInterface();
                    break;
                case "RESTRICTIONS":
                    sap.m.MessageToast.show("Restriction alert clicked");
                    break;
                default:
                    sap.m.MessageToast.show("Unknown card action: " + actionId);
            }
        },
        _navigateToProcessJobs: async function () {
            try {
                if (sap.ushell && sap.ushell.Container && sap.ushell.Container.getService) {
                    var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
                    // generate the Hash to display 
                    var hash = (oCrossAppNavigator && oCrossAppNavigator.hrefForExternal({
                        target: {
                            semanticObject: "jobschedulersequence",
                            action: "display"
                        }
                    })) || "";
                    //Generate a  URL for the second application
                    var url = window.location.href.split('#')[0] + hash;
                    //Navigate to second app
                    sap.m.URLHelper.redirect(url, true);
                }
            } catch (err) {
                console.error("Failed to navigate to Process Jobs:", err);
            }
        },

        _navigateToInterface: async function () {
            try {
                if (sap.ushell && sap.ushell.Container && sap.ushell.Container.getService) {
                    var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
                    // generate the Hash to display 
                    var hash = (oCrossAppNavigator && oCrossAppNavigator.hrefForExternal({
                        target: {
                            semanticObject: "jobschedulersequence",
                            action: "display"
                        }
                    })) || "";
                    //Generate a  URL for the second application
                    var url = window.location.href.split('#')[0] + hash;
                    //Navigate to second app
                    sap.m.URLHelper.redirect(url, true);
                }
            } catch (err) {
                console.error("Failed to navigate to Interface:", err);
            }
        },

        _loadCharCards: async function () {
            const oModel = this.getOwnerComponent().getModel();
            const oCard = this.byId("MyCardIdFore");
            if (oCard) oCard.setBusy(true);
            if (!oModel) {
                console.error("OData model not available");
                return;
            }
            var aFilters = [];
            // Get selected keys
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();
            if (locSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("LOCATION_ID", "EQ", locSelectedKey));
            }
            if (prodSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("PRODUCT_ID", "EQ", prodSelectedKey));
            }
            const aFilters1 = Array.isArray(aFilters) ? aFilters : [];
            const iPageSize = 5000; // tune this depending on your service
            let iSkip = 0;
            let aAllResults = [];
            let bHasMore = true;
            while (bHasMore) {
                // var url = `/getDMDAnalytical?$filter=LOCATION_ID eq '1600'`
                const aContexts = await this.oModel
                    .bindList("/getDMDAnalytical", null, [], aFilters1)
                    .requestContexts(iSkip, iPageSize);
                const aPageResults = aContexts.map(ctx => ctx.getObject());
                aAllResults = aAllResults.concat(aPageResults);
                // If we got less than requested, it's the last page
                if (aPageResults.length < iPageSize) {
                    bHasMore = false;
                } else {
                    iSkip += iPageSize;
                }
            }
            console.log("Total records loaded:", aAllResults.length);
            if (aAllResults.length === 0) {
                sap.m.MessageToast.show("No data available in WoW variance analysis for selected Location & Product");
                that.onFilterResetWOW();
            } else {
                const oWOWModel = new sap.ui.model.json.JSONModel({
                    options: [
                        { key: "Actual WoW", text: "Actual" },
                        { key: "Forecast WoW", text: "Forecast" }
                    ],
                    selectedKey: "Actual WoW" // ✅ Default selection
                });
                // Set the model at view level
                this.getView().setModel(oWOWModel, "wowModel");
                const oWOWModelVariance = new sap.ui.model.json.JSONModel({
                    Variance: [
                        { key: "10", text: ">10" },
                        { key: "20", text: ">20" },
                        { key: "30", text: ">30" }
                    ],
                    selectedKey: "10" // ✅ Default selection
                });
                // Set the model at view level
                this.getView().setModel(oWOWModelVariance, "wowModelVariance");
                that.wowData = aAllResults;
                var actualWOW = aAllResults.filter(id => id.COMP_TYPE === "Actual WoW" && id.PERCENT_DIFF_WOW > 0.10);
                // const oAssemblyModel = new sap.ui.model.json.JSONModel({ Assembly: that.forecastData });
                this._setActualForecastCard(actualWOW, "Actual");
            }
            oCard.setBusy(false);
        },
        _setActualForecastCard(oData) {
            oData.forEach(d => {
                if (d.THIS_WEEK_DATE?.includes("/Date(")) {
                    const timestamp = parseInt(d.THIS_WEEK_DATE.match(/\d+/)[0]);
                    d.THIS_WEEK_DATE = new Date(timestamp).toISOString().split("T")[0];
                }
            });
            var oVizFrame = this.byId("MyCardIdFore");
            oVizFrame.setBusy(true);
            var oPopOver = new sap.viz.ui5.controls.Popover({});
            oPopOver.connect(oVizFrame.getVizUid());
            oVizFrame.setVizProperties({
                title: { visible: true, text: "WoW Variance" },
                plotArea: {
                    dataLabel: { visible: true },
                    colorPalette: ["#5899DA", "#E8743B", "#19A979", "#ED4A7B", "#945ECF", "#13A4B4"]
                },
                categoryAxis: {
                    title: { visible: true }
                },
                valueAxis: {
                    title: { visible: true }
                },
                legend: { visible: false }
            });
            var oModel = new sap.ui.model.json.JSONModel({ wowVarianceType: oData });
            this.getView().setModel(oModel, "wowVariance");
            oVizFrame.setBusy(false);
            sap.ui.core.BusyIndicator.hide();
        },
        onVarianceChange: function (oEvent) {
            var selectedType = that.byId("idWOW").getSelectedKey();
            var selectedVariance = oEvent.getSource().getSelectedKey();
            var actualWOW = that.wowData.filter(id => id.COMP_TYPE === selectedType && parseInt(id.PERCENT_DIFF_WOW) > parseInt(selectedVariance));
            this._setActualForecastCard(actualWOW);
        },
        onTypeChange: function (oEvent) {
            var selectedType = oEvent.getSource().getSelectedKey();
            var selectedVariance = that.byId("idVariance").getSelectedKey();
            var actualWOW = that.wowData.filter(id => id.COMP_TYPE === selectedType && parseInt(id.PERCENT_DIFF_WOW) > parseInt(selectedVariance));
            this._setActualForecastCard(actualWOW);
        },
        onFilterResetWOW: function () {
            that.byId("idVariance").setSelectedKey("Actual WoW");
            that.byId("idWOW").setSelectedKey("0.10");
            var oModel = new sap.ui.model.json.JSONModel({ wowVarianceType: [] });
            this.getView().setModel(oModel, "wowVariance");
        },

        handleCloseButton: function (oEvent) {
            this.byId("myPopover").close();
        },
        onOpenQuickHelp: function (oEvent) {
            var oButton = oEvent.getSource(),
                oView = this.getView();

            if (!this._pPopover) {
                this._pPopover = Fragment.load({
                    id: oView.getId(),
                    name: "vcp.vcplannerdashboard.view.Popover",
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);
                    // oPopover.bindElement("/ProductCollection/0");
                    return oPopover;
                });
            }
            this._pPopover.then(function (oPopover) {
                oPopover.openBy(oButton);
            });
        },
        handleLinkPress: async function (oEvent) {
            var selectedApp = oEvent.getSource().getText();
            try {
                switch (selectedApp) {
                    case "Option Mix Planning":
                        var semanticObject = "getOptionpercentages",
                            action = "display";
                        break;

                    case "Forecast Orders":
                        var semanticObject = "vcpforecastingorders",
                            action = "display";
                        break;
                    case "Assembly Requirements":
                        var semanticObject = "vcpmaterialrequirements",
                            action = "display";
                        break;
                    case "Restriction Likelihood":
                        var semanticObject = "vcpvendergoodcapacity",
                            action = "display";
                        break;
                    default:
                        break;
                }
                if (sap.ushell && sap.ushell.Container && sap.ushell.Container.getService) {
                    var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
                    // generate the Hash to display 
                    var hash = (oCrossAppNavigator && oCrossAppNavigator.hrefForExternal({
                        target: {
                            semanticObject: semanticObject,
                            action: action
                        }
                    })) || "";
                    //Generate a  URL for the second application
                    var url = window.location.href.split('#')[0] + hash;
                    //Navigate to second app
                    sap.m.URLHelper.redirect(url, true);
                }
            } catch (err) {
                console.error("Failed to navigate to :", err);
            }
        },
        loadAllLags: async function () {
            await that.loadAssemblyFac();
        },
        //Load factory location for Assemly lag
        loadAssemblyFac: async function () {
            sap.ui.core.BusyIndicator.show();
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();
            var aFilters = [];
            // ✅ Add filters only when values exist
            if (locSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("LOCATION_ID", sap.ui.model.FilterOperator.EQ, locSelectedKey));
            }
            if (prodSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("PRODUCT_ID", sap.ui.model.FilterOperator.EQ, prodSelectedKey));
            }
            const iPageSize = 5000; // tune this depending on your service
            let iSkip = 0;
            let aAllResults = [];
            let bHasMore = true;
            while (bHasMore) {
                const aContexts = await this.oModel
                    .bindList("/getAssemblyData", null, null, aFilters)
                    .requestContexts(iSkip, iPageSize);
                const aPageResults = aContexts.map(ctx => ctx.getObject());
                aAllResults = aAllResults.concat(aPageResults);
                // If we got less than requested, it's the last page
                if (aPageResults.length < iPageSize) {
                    bHasMore = false;
                } else {
                    iSkip += iPageSize;
                }
            }
            console.log("Total records loaded:", aAllResults.length);
            if (aAllResults.length === 0) {
                sap.m.MessageToast.show("No data available in Forecast accuracy for selected Location & Product");
                this.byId("cbFactory").setSelectedKey("");
                this.byId("cbStartMonth").setSelectedKey("");
                this.byId("cbEndMonth").setSelectedKey("");
                that.keySettingData = undefined
                that.oGModel.setProperty("/showPivot", false);
                that.oGModel.setProperty("/tableType", 'Table');
                that.allData = [];
                var existingDiv = document.querySelector('[id*="mainDivLag"]');
                if (existingDiv.children.length > 0) {
                    while (existingDiv.firstChild) {
                        existingDiv.removeChild(existingDiv.firstChild);
                    }
                }
            } else {
                that.totalAssemblyData = aAllResults;
                var facLocation = that.removeDuplicates(aAllResults, "FACTORY_LOC");
                var factoryDescription = that.oGModel.getProperty("/fullLocData");
                // Extract matching LOCATION_DESC
                const descMap = factoryDescription.reduce((acc, curr) => {
                    acc[curr.LOCATION_ID] = curr.LOCATION_DESC;
                    return acc;
                }, {});
                // Add LOCATION_DESC to each object in facLocation
                const facLocationWithDesc = facLocation.map(item => ({
                    ...item,
                    LOCATION_DESC: descMap[item.FACTORY_LOC] || "Unknown"
                }));
                const olocModel = new sap.ui.model.json.JSONModel({ Location: facLocationWithDesc });
                this.getView().setModel(olocModel, "location");
                setTimeout(() => {
                    var oLocation = this.byId("cbFactory");
                    var oBinding = oLocation.getBinding("items");
                    if (oBinding) {
                        var aItems = oLocation.getItems();
                        if (aItems.length > 0) {
                            oLocation.setSelectedKey(aItems[0].getKey());
                            oLocation.fireSelectionChange({ selectedItem: aItems[0] });
                        }
                    }
                }, 0);
            }
        },
        onFacLocChange: async function (oEvent) {
            sap.ui.core.BusyIndicator.show();
            var calendarDate = that.oGModel.getProperty("/CalendarData");
            var calendarDateEnd = calendarDate;
            const calendarModelStart = new sap.ui.model.json.JSONModel({ MONTHDATA: calendarDate });
            that.getView().setModel(calendarModelStart, "calendarStart");
            const calendarModelEnd = new sap.ui.model.json.JSONModel({ MONTHDATAEND: calendarDateEnd });
            that.getView().setModel(calendarModelEnd, "calendarEnd");
            var oCalendarStart = this.byId("cbStartMonth");
            var oCalendarEnd = this.byId("cbEndMonth");
            const date = new Date();
            const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                .toISOString()
                .split("T")[0];
            setTimeout(() => {
                const aItems = calendarDate;
                if (aItems.length > 0) {
                    const index = aItems.findIndex(id =>
                        id.WEEK_STARTDATE <= local && id.WEEK_ENDDATE >= local
                    );
                    if (index !== -1) {
                        const endIndex = (index - 4 < aItems.length) ? index - 4 : aItems.length + 1;
                        oCalendarStart.setSelectedKey(aItems[endIndex].PERIODDESC);
                        oCalendarEnd.setSelectedKey(aItems[index].PERIODDESC);
                        // Fire selection events if required
                        oCalendarEnd.fireSelectionChange({ selectedItem: aItems[index] });
                    }
                }
            }, 200);
            sap.ui.core.BusyIndicator.hide();
        },

        onGo: async function () {
            try {
                that.getView().setBusy(true);
                const FLoc = this.byId("cbFactory").getSelectedKey();
                const Loc = this.byId("LocationSelect").getSelectedKey();
                const Prod = this.byId("productSelect").getSelectedKey();
                const Mstart = this.byId("cbStartMonth").getSelectedKey();
                const MEnd = this.byId("cbEndMonth").getSelectedKey();
                if (!FLoc || !Loc || !Prod || !Mstart || !MEnd) {
                    that.getView().setBusy(false)
                    return MessageToast.show("Select Required Filter");
                }
                let oRes, data;
                that.ActualQty = [];
                that.NormalQty = [];
                that.allData = [];
                const type = that.byId("idTypeBox").getSelectedKey();
                if (type === "Assembly") {
                    oRes = await that.callFunction("getAssemblyLagfun", {
                        FACTORY_LOCATION: FLoc, LOCATION: Loc, PRODUCT: Prod, START_MONTH: Mstart, END_MONTH: MEnd
                    });
                    data = oRes;
                    that.staticColumns = ["Assembly", "Lag Month"];
                    if (that.KeyFig) {
                        that.staticColumns = that.KeyFig;
                    }
                    that.byId("idkeyFig").setVisible(true);
                }
                if (type === "Product") {
                    oRes = await that.callFunction("getPrdDmdLagFun", {
                        FACTORY_LOCATION: FLoc, LOCATION: Loc, PRODUCT: Prod, START_MONTH: Mstart, END_MONTH: MEnd
                    });
                    data = oRes;
                    that.staticColumns = ["Location", "Product", "Lag Month"]
                    that.byId("idkeyFig").setVisible(false);
                }
                if (type === "Restriction") {
                    oRes = await that.callFunction("getRestrictionLagFun", {
                        FACTORY_LOCATION: FLoc, LOCATION: Loc, START_MONTH: Mstart, END_MONTH: MEnd
                    });
                    data = oRes;
                    that.staticColumns = ["Line", "Restriction", "Lag Month"]
                    that.byId("idkeyFig").setVisible(false);
                }
                if (type === "Characteristic") {
                    oRes = await that.callFunction("getOptPercentLagFun", {
                        FACTORY_LOCATION: FLoc, LOCATION: Loc, PRODUCT: Prod, START_MONTH: Mstart, END_MONTH: MEnd
                    });
                    data = oRes;
                    that.staticColumns = ["Characteristic", "Characteristic value", "Lag Month"]
                    that.byId("idkeyFig").setVisible(false);
                }
                if (type === "StatFore") {
                    oRes = await that.callFunction("getStatForecast", {
                        FACTORY_LOCATION: FLoc, LOCATION: Loc, PRODUCT: Prod, START_MONTH: Mstart, END_MONTH: MEnd
                    });
                    data = oRes;
                    that.staticColumns = ["Characteristic", "Characteristic value", "Lag Month"]
                    that.byId("idkeyFig").setVisible(false);
                }
                that.allData = data;
                that.updateQty();
                that.loadPivotTable(that.allData);
                that.getView().setBusy(false);
            } catch (error) {
                console.error(error);
                that.getView().setBusy(false);
            }
        },
        callFunction: async function (entity, oParameters) {
            try {
                // Bind to the function import
                const oFunction = this.oModel.bindContext(`/${entity}(...)`);
                // Set each parameter dynamically
                for (const [key, value] of Object.entries(oParameters)) {
                    oFunction.setParameter(key, value);
                }
                // Execute the function
                await oFunction.execute();
                // Get bound context
                const oCtx = oFunction.getBoundContext();
                if (!oCtx) {
                    console.warn(`⚠️ No response context for ${sFunctionName}`);
                    return null;
                }
                const oResult = oCtx.getObject();
                // Auto-parse JSON results (if backend returns stringified JSON)
                if (oResult?.value) {
                    try {
                        return JSON.parse(oResult.value.value);
                    } catch {
                        return oResult.value;
                    }
                }
                return oResult;
            } catch (err) {
                console.error(`❌ Function call failed: ${sFunctionName}`, err);
                throw err;
            }
        },
        onChnageType() {
            that.onGo();
        },
        onPressKey() {
            that.keyFrag.open();
            const table = sap.ui.getCore().byId("idkeyTablelag");
            that.table = table;
            if (!that.keySettingData) {
                that.keySettingData = [{
                    field: "Assembly",
                    select: true
                },
                {
                    field: "MRP Group",
                    select: false
                },
                {
                    field: "Lag Month",
                    select: true
                }
                ];
                var oModel = new JSONModel({
                    data: that.keySettingData,
                });
                table.setModel(oModel);
            }
        },
        onAddKey: function () {
            try {
                const dataTable = that.table;
                const selectItems = dataTable.getSelectedItems();
                const keyFig = selectItems.map((col) => {
                    return col.getBindingContext().getObject().field
                });
                that.KeyFig = keyFig;
                that.staticColumns = keyFig;
                that.loadPivotTable(that.allData);
                that.keyFrag.close();
            } catch (error) {
                console.error("Error in onAddColumn:", error);
            }
        },
        checkSelect: function () {
            const table = that.table;
            table.getItems().forEach((item, index) => {
                const obj = item.getBindingContext().getObject();
                if (obj.field === "Assembly" || obj.field === "Lag Month") {
                    item.setSelected(true);
                }
            });
        },
        handleSearchs: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var oFilter = new Filter("ASSEMBLY_DESC", FilterOperator.Contains, sValue);
            var oBinding = oEvent.getSource().getBinding("items");
            oBinding.filter([oFilter]);
        },
        updateQty() {
            that.ActualQty = [];
            that.NormalQty = [];
            let text = that.byId("idMapTypeGroup").getSelectedButton().getText();
            let val;
            if (text === "MAPE") {
                val = "MAPE";
            } else if (text === "MAPE Quantity") {
                val = "MAPE_QTY";
            } else if (text === "Lag Quantity") {
                val = "LAG_QTY";
            }
            const type = that.byId("idTypeBox").getSelectedKey();
            // Using Maps to aggregate values by key
            const actualMap = new Map();
            const normalMap = new Map();
            that.allData.forEach(o => {
                let key;
                if (type === "Assembly") {
                    key = `${o.ASSEMBLY_DESC}_${o.SELECTED_MONTH}`;
                } else if (type === "Product") {
                    key = `${o.LOCATION_ID}_${o.PRODUCT_ID}_${o.SELECTED_MONTH}`;
                } else if (type === "Restriction") {
                    key = `${o.LINE_ID}_${o.RESTRICTION}_${o.SELECTED_MONTH}`;
                } else if (type === "Characteristic") {
                    key = `${o.CHAR_DESC}_${o.CHARVAL_DESC}_${o.SELECTED_MONTH}`;
                }
                else if (type === "Statastical Forecast") {
                    key = `${o.CHAR_DESC}_${o.CHARVAL_DESC}_${o.SELECTED_MONTH}`;
                }
                const value = o[val] || 0;
                if (o.LAG_MONTH == 0) {
                    // Sum values for ActualQty
                    actualMap.set(key, (actualMap.get(key) || 0) + value);
                } else {
                    // Sum values for NormalQty
                    normalMap.set(key, (normalMap.get(key) || 0) + value);
                }
            });
            // Convert Maps to arrays
            that.ActualQty = Array.from(actualMap.values());
            that.NormalQty = Array.from(normalMap.values());
        },
        onSelectMapType(e) {
            that.updateQty();
            that.loadPivotTable(that.allData);
        },
        jsonToPivotData: function (json) {
            const headers = [];
            const keys = Object.keys(json[0]);
            keys.forEach(key => {
                let label;
                switch (key) {
                    case "CHAR_NUM":
                        label = "Characteristic Id";
                        break;
                    case "CHAR_DESC":
                        label = "Characteristic";
                        break;
                    case "CHARVAL_DESC":
                        label = "Characteristic value";
                        break;
                    case "CHARVAL_NUM":
                        label = "Characteristic Id value";
                        break;
                    case "LINE_ID":
                        label = "Line";
                        break;
                    case "RESTRICTION":
                        label = "Restriction";
                        break;
                    case "FACTORY_LOC":
                        label = "Manufacturing Location";
                        break;
                    case "LOCATION_ID":
                        label = "Location";
                        break;
                    case "LOCATION_DESC":
                        label = "Location Description";
                        break;
                    case "PRODUCT_ID":
                        label = "Product"
                        break;
                    case "PROD_DESC":
                        label = "Product Description"
                        break;
                    case "ASSEMBLY":
                        label = "Assembly ID";
                        break;
                    case "ASSEMBLY_DESC":
                        label = "Assembly";
                        break;
                    case "MRP_GROUP":
                        label = "MRP Group";
                        break;
                    case "MRP_TYPE":
                        label = "MRP Type";
                        break;
                    case "SELECTED_MONTH":
                        label = "Telescopic Week";
                        break;
                    case "LAG_MONTH":
                        label = "Lag Month";
                        break;
                    case "ACTUAL_MONTH":
                        label = "Actual Month";
                        break;
                    case "LAG_QTY":
                        label = "Lag Quantity";
                        break;
                    case "ACTUAL_QTY":
                        label = "Actual Quantity";
                        break;
                    case "MAPE":
                        label = "MAPE";
                        break;
                    case "MAPE_QTY_ABS":
                        label = "MAPE Quantity (Absolute)";
                        break;
                    case "MRP_GROUP":
                        label = "MRP Group";
                        break;
                    case "MAPE_QTY":
                        label = "MAPE Quantity";
                        break;
                    default:
                        label = key;
                        break;
                }
                headers.push(label);
            });

            const data = json.map(item => Object.values(item));
            return [headers, ...data];
        },
        loadPivotTable: function (data, rows, val) {
            if (!data.length) {
                // that.oGModel.setProperty("/showPivot", false);
                that.byId('pivotPageLag').setBusy(false);
                var existingDiv = document.querySelector(`[id*=mainDiv]`);
                if (existingDiv && existingDiv.children.length > 0) {
                    while (existingDiv.firstChild) {
                        existingDiv.removeChild(existingDiv.firstChild);
                    }
                }
                return MessageToast.show("No Data in Forecast accuracy for the selections");
            }
            that.oGModel.setProperty("/showPivot", true);
            that.isTableBarChart = true;
            var newDiv = document.createElement("div");
            newDiv.id = `pivotGrid`;
            newDiv.textContent = "";
            var existingDiv = document.querySelector(`[id*='mainDivLag']`);
            if (existingDiv.children.length > 0) {
                while (existingDiv.firstChild) {
                    existingDiv.removeChild(existingDiv.firstChild);
                }
            }
            existingDiv.appendChild(newDiv);
            var pivotDiv = document.querySelector(`[id*='pivotGrid']`);
            // Check if jQuery and PivotUI are available
            if (window.jQuery && window.jQuery.fn.pivot) {
                const tableType = that.oGModel.getProperty("/tableType");
                const isTableType = tableType.includes('Table') ||
                    tableType.includes('Heatmap');
                const pivotData = that.jsonToPivotData(data);
                if (!rows) {
                    var rows = that.staticColumns;
                }
                that.staticColumns = rows;
                let text = that.byId("idMapTypeGroup").getSelectedButton().getText()
                let val;
                if (text === "MAPE") {
                    val = ["MAPE"]
                }
                else if (text === "MAPE Quantity") {
                    val = [text]
                }
                else if (text === "Lag Quantity") {
                    val = [text]
                }
                that.value = val;
                let cols = ["Telescopic Week"];
                const labels = [
                    "Characteristic",
                    "Characteristic value",
                    "Characteristic Id",
                    "Characteristic Id value",
                    "Location Description",
                    "Product Description",
                    "Line",
                    "Restriction",
                    "Manufacturing Location",
                    "Location",
                    "Product",
                    "Assembly ID",
                    "Assembly",
                    "MRP Group",
                    "MRP Type",
                    "Telescopic Week",
                    "Lag Month",
                    "Actual Month"
                ];
                const remaainlabel = labels.filter(l => !rows.includes(l) && !cols.includes(l));
                remaainlabel.push("Lag Quantity",
                    "Actual Quantity",
                    "MAPE",
                    "MAPE Quantity (Absolute)",
                    "MAPE Quantity");
                $(pivotDiv).pivotUI(pivotData, {
                    rows: rows,
                    cols: cols,
                    vals: val, // Just use one value for simple sum
                    aggregatorName: "Sum",
                    rendererName: "Heatmap",
                    showUI: that.byId("idFilterCheck").getSelected(),
                    hiddenFromDragDrop: remaainlabel,
                    sorters: {
                    },
                    renderers: $.extend(
                        $.pivotUtilities.renderers,
                        $.pivotUtilities.plotly_renderers
                    ),
                    rendererOptions: {
                        table: {
                            colTotals: false,
                            rowTotals: false
                        },
                        heatmap: {
                            colorScaleGenerator: function (values) {
                                const ignoreValues = that.ActualQty;
                                const normalValue = that.NormalQty;
                                var filteredValues = values.filter(function (v) {
                                    if (v === null || v === undefined) return false;
                                    const inIgnore = ignoreValues.includes(v);
                                    const inNormal = normalValue.includes(v);
                                    // If in both arrays, keep it (don't ignore)
                                    if (inIgnore && inNormal) return true;
                                    // If only in ignore array, filter it out
                                    if (inIgnore && !inNormal) return false;
                                    // Otherwise, keep it
                                    return true;
                                });
                                if (filteredValues.length === 0) return Plotly.d3.scale.linear();
                                var min = Math.min.apply(Math, filteredValues);
                                var max = Math.max.apply(Math, filteredValues);
                                var mid = (min + max) / 2;
                                return Plotly.d3.scale.linear()
                                    .domain([min, mid, max])
                                    .range(["#B3E5FC", "#2196F3", "#0D47A1"]);
                            }
                        }
                    }
                });
                that.loadPivotCss();
                $('.pvtFilterBox button:contains("Apply")').on('click.myTracker', function (e) {
                    that.loadPivotCss();
                });
                that.byId('pivotPageLag').setBusy(false);
            } else {
                console.error("Pivot.js or jQuery is not loaded yet.");
                that.byId('pivotPageLag').setBusy(false);
            }
        },
        onFilter() {
            that.loadPivotTable(that.allData);
        },
        loadPivotCss() {
            $(".pvtTable").ready(function () {
                setTimeout(function () {
                    // Handle chart renderer control
                    // Hide last row (totals row)
                    // $(".pvtTable").find("tr:last").hide();
                    // $(".pvtTable").find('thead:first tr:first th:last-child').hide();
                    // Adjust vertical alignment for headers with large rowspan
                    $(".pvtTable").find('th[rowspan]').each(function () {
                        if (parseInt($(this).attr('rowspan')) > 7) {
                            $(this).css('vertical-align', 'top');
                        }
                    });
                    $(".pvtTable").find('th').each(function () {
                        const text = $(this).text().trim();
                        // Replace '0' with 'Actual'
                        if (text === '0') {
                            $(this).html("Actual");
                        }
                        // Highlight the header that matches curWeek
                        if (text === that.curWeek) {
                            $(this).css("background-color", "#ffe08a"); // light yellow highlight
                        }
                    });
                    const allWeek = $(".mainDivClass .pvtTable").find("thead tr:first th");
                    if (that.calWeekData && that.calWeekData.length)
                        $(allWeek).each(function (e) {
                            const cellText = $(this).text();
                            $(this).addClass("weekHeader");
                            const popoverHtml = `
                    <div class="popover">
                        <div class="popover-content">
                            <div class="date-row">
                                <span class="date-label">From:</span>
                                <span class="From${cellText}">28 April 2025</span>
                            </div>
                            <div class="date-row">
                                <span class="date-label">To:</span>
                                <span class="To${cellText}">05 May 2025</span>
                            </div>
                        </div>
                    </div>`;

                            // Add popover to header cell
                            $(this).append(popoverHtml);

                            // On hover, update date
                            $(this).hover(function () {
                                that.updateDate(cellText);
                            });
                        });

                    // Freeze columns in thead
                    function freezeHeaderColumns() {
                        // Process first row of thead
                        const firstHeadRow = $(".pvtTable").find('thead tr:first');
                        if (firstHeadRow.length) {
                            let widthsHead = [0];
                            // Calculate cumulative widths for first 3 columns (Location, Product, Assembly)
                            const columnsToFreeze = Math.min(2, firstHeadRow.find('th').length);
                            // const columnsToFreeze = 2;
                            for (let i = 0; i < columnsToFreeze; i++) {
                                const th = firstHeadRow.find(`th:eq(${i})`);
                                if (th.length) {
                                    const borderWidth = parseFloat(th.css('border-left-width') || '0') +
                                        parseFloat(th.css('border-right-width') || '0');
                                    const paddingWidth = parseFloat(th.css('padding-left') || '0') +
                                        parseFloat(th.css('padding-right') || '0');
                                    const width = parseFloat(th.css("width") || '0') + borderWidth + paddingWidth;
                                    widthsHead.push(widthsHead[i] + width);
                                }
                            }
                            // Apply freeze positioning
                            firstHeadRow.find('th').each(function (index) {
                                if (index < columnsToFreeze) {
                                    $(this).addClass('frezzThead');
                                    $(this).css('left', `${widthsHead[index]}px`);
                                }
                            });
                        }
                        // Process second row of thead (axis labels)
                        const secondHeadRow = $(".pvtTable").find('thead tr:eq(1)');
                        if (secondHeadRow.length) {
                            let widthsHead2 = [0];
                            const thElements = secondHeadRow.find('th');
                            const columnsToFreeze = thElements.length;
                            // Calculate widths for columns to freeze
                            for (let i = 0; i < columnsToFreeze; i++) {
                                const th = thElements.eq(i);
                                const borderWidth = parseFloat(th.css('border-left-width') || '0') +
                                    parseFloat(th.css('border-right-width') || '0');
                                const paddingWidth = parseFloat(th.css('padding-left') || '0') +
                                    parseFloat(th.css('padding-right') || '0');
                                const width = parseFloat(th.css("width") || '0') + borderWidth + paddingWidth;
                                widthsHead2.push(widthsHead2[i] + width);
                            }
                            // Apply freeze positioning
                            thElements.each(function (index) {
                                if (index < columnsToFreeze) {
                                    $(this).addClass('frezzThead');
                                    $(this).css('left', `${widthsHead2[index]}px`);
                                }
                            });
                        }
                    }
                    // Freeze columns in tbody
                    function freezeBodyColumns() {
                        const tbody = $(".pvtTable").find('tbody');
                        if (!tbody.length) return;
                        // Find row with most th elements to use as reference
                        let maxThCount = 0;
                        let referenceRow = null;
                        tbody.find('tr').each(function () {
                            const thCount = $(this).find('th').length;
                            if (thCount > maxThCount) {
                                maxThCount = thCount;
                                referenceRow = $(this);
                            }
                        });
                        if (!referenceRow || maxThCount === 0) return;
                        // Calculate cumulative widths for the columns to freeze
                        let widths = [0];
                        for (let i = 0; i < maxThCount; i++) {
                            const th = referenceRow.find(`th:eq(${i})`);
                            if (th.length) {
                                const borderWidth = parseFloat(th.css('border-left-width') || '0') +
                                    parseFloat(th.css('border-right-width') || '0');
                                const paddingWidth = parseFloat(th.css('padding-left') || '0') +
                                    parseFloat(th.css('padding-right') || '0');
                                const width = parseFloat(th.css("width") || '0') + borderWidth + paddingWidth;
                                widths.push(widths[i] + width);
                            }
                        }
                        // Apply freeze positioning to each row
                        tbody.find('tr').each(function () {
                            const thElements = $(this).find('th');
                            const currentThCount = thElements.length;

                            thElements.each(function (index) {
                                // Adjust for rows with fewer th elements than the reference row
                                let positionIndex = index;
                                if (currentThCount < maxThCount) {
                                    // Calculate offset based on hierarchy level
                                    positionIndex += (maxThCount - currentThCount);
                                }

                                $(this).addClass('frezz');
                                $(this).css('left', `${widths[positionIndex]}px`);
                            });
                        });
                    }

                    // Format number cells (remove decimals, replace empty cells with 0)
                    function formatCells() {
                        $(".mainDivClass .pvtTable")
                            .find("td")
                            .each(function () {
                                let cellText = $(this).text().trim();
                                if (cellText === "") {
                                    $(this).text("0");
                                }
                                if (cellText.includes(".")) {
                                    $(this).text(cellText.split(".")[0]);
                                }
                                let rowHeader = $(".pvtTable").find(`tr:eq(${$(this)?.parent()?.index() + 2}) th`).filter((_, th) => $(th).text().trim() == "Actual").length > 0 ? 'Actual' : "";
                                if (rowHeader == 'Actual') {
                                    $(this).closest('tr').find('td').addClass('actual');
                                }
                            });
                    }

                    // Execute all functions
                    freezeHeaderColumns();
                    freezeBodyColumns();
                    // if (that.isTableBarChart)
                    formatCells();
                }, 300); // Delay to ensure table is fully rendered
            });
        },
        updateDate(week) {
            try {
                const Calendar = Array.isArray(that.calWeekData)
                    ? that.calWeekData.filter(o => o && o.PERIODDESC == week)
                    : [];

                const fromElem = document.getElementsByClassName(`From${week}`)[0];
                const toElem = document.getElementsByClassName(`To${week}`)[0];

                if (Calendar.length === 0) {
                    $('.popover').hide()
                    return;
                }
                $('.popover').show()
                const startDate = Calendar[0]?.WEEK_STARTDATE instanceof Date
                    ? Calendar[0].WEEK_STARTDATE
                    : new Date(Calendar[0]?.WEEK_STARTDATE);
                const endDate = Calendar[Calendar.length - 1]?.WEEK_ENDDATE instanceof Date
                    ? Calendar[Calendar.length - 1].WEEK_ENDDATE
                    : new Date(Calendar[Calendar.length - 1]?.WEEK_ENDDATE);

                const startDateStr = isNaN(startDate) ? "" : startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                const endDateStr = isNaN(endDate) ? "" : endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

                if (fromElem) fromElem.innerHTML = startDateStr;
                if (toElem) toElem.innerHTML = endDateStr;

            } catch (e) {
                console.error("Error in updateDate:", e);
            }
        },
        // 
        onAdaptWidgets: function (oEvent) {
            const oView = this.getView();
            const oButton = oEvent.getSource();
            const that = this;

            // ✅ Helper function to (re)apply selections
            function applyWidgetSelections(oPopover) {
                const oTable = sap.ui.core.Fragment.byId(oView.getId(), "idWidgetTable");
                if (!oTable) return;

                if (that._aSelectedWidgets && that._aSelectedWidgets.length > 0) {
                    oTable.removeSelections(); // clear before re-selecting
                    oTable.getItems().forEach(item => {
                        const oData = item.getBindingContext().getObject();
                        if (that._aSelectedWidgets.some(w => w.ID === oData.ID)) {
                            oTable.setSelectedItem(item, true);
                        }
                    });
                }
            }

            // ✅ If popover already exists, reuse it
            if (this._oWidgetPopover) {
                if (this._oWidgetPopover.isOpen && this._oWidgetPopover.isOpen()) {
                    this._oWidgetPopover.close();
                } else {
                    applyWidgetSelections(this._oWidgetPopover); // 🔁 re-apply selection each time it opens
                    this._oWidgetPopover.openBy(oButton);
                }
                return;
            }
            // ✅ Load fragment first time
            sap.ui.core.Fragment.load({
                id: oView.getId(),
                name: "vcp.vcplannerdashboard.view.AdaptWidgets",
                controller: this
            }).then(function (oPopover) {
                oView.addDependent(oPopover);
                that._oWidgetPopover = oPopover;
                // Mock widget data
                const widgetNames = ["Alerts", "Forecast Accuracy", "WoW Variance"];
                const aWidgets = widgetNames.map((name, i) => ({ ID: i + 1, Name: name }));
                const oWidgetModel = new sap.ui.model.json.JSONModel({
                    widgetCollection: aWidgets
                });
                oPopover.setModel(oWidgetModel);
                // Attach afterOpen for first-time rendering
                oPopover.attachAfterOpen(function () {
                    applyWidgetSelections(oPopover);
                });
                oPopover.openBy(oButton);
            }).catch(function (oError) {
                console.error("Failed to load AdaptWidgets fragment:", oError);
            });
        },

        onWidgetSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("newValue");
            const oTable = Fragment.byId(this.getView().getId(), "idWidgetTable");
            const oBinding = oTable.getBinding("items");
            if (sQuery) {
                const oFilter = new sap.ui.model.Filter("Name", sap.ui.model.FilterOperator.Contains, sQuery);
                oBinding.filter([oFilter]);
            } else {
                oBinding.filter([]);
            }
        },

        onSelectWidget: function () {
            const oTable = Fragment.byId(this.getView().getId(), "idWidgetTable");
            const aSelectedItems = oTable.getSelectedItems();
            // Extract selected widget objects
            const aSelectedWidgets = aSelectedItems.map(function (item) {
                return item.getBindingContext().getObject();
            });
            // ✅ Save confirmed selection for persistence
            this._aSelectedWidgets = aSelectedWidgets;
            // Extract names
            const aNames = aSelectedWidgets.map(w => w.Name);
            // --- Visibility logic ---
            const oAlerts = this.byId("alertsPanel");
            const oLags = this.byId("lagsPanel");
            const oForecast = this.byId("idRow4");
            oAlerts.setVisible(aNames.includes("Alerts"));
            oLags.setVisible(aNames.includes("Forecast Accuracy"));
            oForecast.setVisible(aNames.includes("WoW Variance"));
            var defaultWidgets = that.oGModel.getProperty("/defaultWidgets");
            defaultWidgets = defaultWidgets.sort(that.dynamicSortMultiple("ID"));
            that._aSelectedWidgets = that._aSelectedWidgets.sort(that.dynamicSortMultiple("ID"));
            if (
                JSON.stringify(that._aSelectedWidgets) !== JSON.stringify(defaultWidgets)
            ) {
                that.byId("idMatListVPD").setModified(true);
            }
            // Close popover
            if (this._oWidgetPopover) {
                this._oWidgetPopover.close();
            }
        },
        dynamicSortMultiple: function () {
            let props = arguments;
            return function (obj1, obj2) {
                var i = 0,
                    result = 0,
                    numberOfProperties = props.length;
                /* try getting a different result from 0 (equal)
                 * as long as we have extra properties to compare
                 */
                while (result === 0 && i < numberOfProperties) {
                    result = that.dynamicSort(props[i])(obj1, obj2);
                    i++;
                }
                return result;
            };
        },
        dynamicSort: function (property) {
            var sortOrder = 1;
            if (property[0] === "-") {
                sortOrder = -1;
                property = property.substr(1);
            }
            return function (a, b) {
                /* next line works with strings and numbers,
                 * and you may want to customize it to your needs
                 */
                var result =
                    a[property] < b[property]
                        ? -1
                        : a[property] > b[property]
                            ? 1
                            : 0;
                return result * sortOrder;
            };
        },
        onCloseWidget: function (oEvent) {
            const oTable = Fragment.byId(this.getView().getId(), "idWidgetTable");
            // ✅ Restore last confirmed selections
            oTable.removeSelections();
            if (this._aSelectedWidgets && this._aSelectedWidgets.length > 0) {
                oTable.getItems().forEach(item => {
                    const oData = item.getBindingContext().getObject();
                    if (this._aSelectedWidgets.some(w => w.ID === oData.ID)) {
                        oTable.setSelectedItem(item, true);
                    }
                });
            }
            // Close popover
            if (this._oWidgetPopover) {
                this._oWidgetPopover.close();
            }
        },
        //Variant Code Starts//
        getVariantData: async function () {
            sap.ui.core.BusyIndicator.show();
            try {
                const variantUser = (this.getUser() || "").toLowerCase();
                // const variantUser = "pradeepkumardaka@sbpcorp.in"
                const appName = this.getOwnerComponent().getManifestEntry("/sap.app/id");
                this.oGModel.setProperty("/UserId", variantUser);

                // --- Build filters ---
                const oFilterUserScope = new sap.ui.model.Filter({
                    filters: [
                        new sap.ui.model.Filter("APPLICATION_NAME", sap.ui.model.FilterOperator.EQ, appName),
                        new sap.ui.model.Filter("USER", sap.ui.model.FilterOperator.EQ, variantUser)
                    ],
                    and: true
                });

                const oFilterPublicScope = new sap.ui.model.Filter({
                    filters: [
                        new sap.ui.model.Filter("APPLICATION_NAME", sap.ui.model.FilterOperator.EQ, appName),
                        new sap.ui.model.Filter("SCOPE", sap.ui.model.FilterOperator.EQ, "Public")
                    ],
                    and: true
                });

                const oFinalFilter = new sap.ui.model.Filter({
                    filters: [oFilterUserScope, oFilterPublicScope],
                    and: false
                });

                // --- Fetch header variants ---
                const aContexts = await this.oModel.bindList("/getVariantHeader", null, [], oFinalFilter).requestContexts();
                const aResults = aContexts.map(ctx => ctx.getObject());
                this.oGModel.setProperty("/headerDetails", aResults);

                // --- VariantManagement control reference ---
                const oVariantMgmt = this.byId("idMatListVPD");

                // --- Handle case: No variants exist ---
                if (aResults.length === 0) {
                    const defaultVariant = [{
                        VARIANTNAME: "Standard",
                        VARIANTID: "0",
                        DEFAULT: "Y",
                        REMOVE: false,
                        CHANGE: false,
                        USER: "SAP",
                        SCOPE: sap.m.SharingMode.Public
                    }];

                    this.oGModel.setProperty("/variantDetails", []);
                    this.oGModel.setProperty("/fromFunction", "X");
                    this.oGModel.setProperty("/viewNames", defaultVariant);
                    this.oGModel.setProperty("/defaultDetails", "");

                    // Update model on VariantManagement
                    const oViewModel = new sap.ui.model.json.JSONModel({ items12: defaultVariant });
                    oVariantMgmt.setModel(oViewModel, "viewDetails");
                    oVariantMgmt.setDefaultKey("0");
                    oVariantMgmt.setSelectedKey("0");

                    // Load Standard variant
                    const newVariant = this.oGModel.getProperty("/newVariant");
                    if (this.oGModel.getProperty("/newVaraintFlag") === "X" && newVariant) {
                        this.handleSelectPress(newVariant[0].VARIANTNAME);
                        this.oGModel.setProperty("/newVaraintFlag", "");
                    } else {
                        this.handleSelectPress("Standard");
                    }

                    sap.ui.core.BusyIndicator.hide();
                    return;
                }

                // --- Handle case: Variants exist ---
                const aUserVariants = [];
                let sDefaultVariantId = null;

                const aProcessed = aResults.map(item => {
                    if (item.DEFAULT === "Y" && item.USER === variantUser) {
                        sDefaultVariantId = item.VARIANTID;
                        aUserVariants.push(item);
                    }
                    if (item.USER !== variantUser) {
                        item.CHANGE = false;
                        item.REMOVE = false;
                        item.ENABLE = false;
                    }
                    return item;
                });

                if (aUserVariants.length) {
                    this.oGModel.setProperty("/defaultVariant", aUserVariants);
                }

                this.oGModel.setProperty("/VariantData", aProcessed);

                // --- Configure VariantManagement UI ---
                const oViewModel = new sap.ui.model.json.JSONModel({ items12: aProcessed });
                oVariantMgmt.setModel(oViewModel, "viewDetails");

                if (sDefaultVariantId) {
                    oVariantMgmt.setDefaultKey(sDefaultVariantId);
                    oVariantMgmt.setSelectedKey(sDefaultVariantId);
                }

                // --- Load variant details ---
                await this.getTotalVariantDetails();

            } catch (err) {
                console.error("Error in getVariantData:", err);
                sap.m.MessageToast.show("Error while loading variant details");
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },

        getTotalVariantDetails: async function () {
            sap.ui.core.BusyIndicator.show();

            try {
                const oVariantMgmt = this.byId("idMatListVPD");
                const headerData = this.oGModel.getProperty("/VariantData") || [];
                const userVariant = this.oGModel.getProperty("/UserId");

                if (!headerData.length) {
                    // sap.m.MessageToast.show("No variant headers found.");
                    sap.ui.core.BusyIndicator.hide();
                    return;
                }

                // --- Build filters dynamically ---
                const oFilters = headerData.map(h =>
                    new sap.ui.model.Filter("VARIANTID", sap.ui.model.FilterOperator.EQ, h.VARIANTID)
                );

                // --- Fetch variant details from backend ---
                const aContexts = await this.oModel.bindList("/getVariant", null, [], oFilters).requestContexts();
                const variantDetailData = aContexts.map(ctx => ctx.getObject());
                this.oGModel.setProperty("/fieldDetails", variantDetailData);

                // --- Merge header + detail data ---
                let mergedData = variantDetailData.map(detail => {
                    const header = headerData.find(h => h.VARIANTID === detail.VARIANTID);
                    return header ? { ...detail, ...header } : { ...detail };
                });

                // Normalize scope display
                mergedData = mergedData.map(item => ({
                    ...item,
                    SCOPE: item.SCOPE === "Public" ? sap.m.SharingMode.Public : sap.m.SharingMode.Private
                }));

                this.oGModel.setProperty("/variantDetails", mergedData);

                // --- Prepare unique variants ---
                let uniqueVariants = this.removeDuplicate(mergedData, "VARIANTNAME");
                const defaultDetails = [];
                let defaultVariantName = null;

                uniqueVariants.forEach(v => {
                    if (v.DEFAULT === "Y" && v.USER === userVariant) {
                        defaultVariantName = v.VARIANTNAME;
                        defaultDetails.push({
                            VARIANTNAME: v.VARIANTNAME,
                            VARIANTID: v.VARIANTID,
                            USER: v.USER,
                            DEFAULT: v.DEFAULT
                        });
                    }
                });

                this.oGModel.setProperty("/defaultDetails", defaultDetails);
                this.oGModel.setProperty("/fromFunction", "X");

                // --- Always prepend Standard view ---
                const standardVariant = {
                    VARIANTNAME: "Standard",
                    VARIANTID: "0",
                    DEFAULT: defaultVariantName ? "N" : "Y",
                    REMOVE: false,
                    CHANGE: false,
                    USER: "SAP",
                    SCOPE: sap.m.SharingMode.Public
                };

                uniqueVariants.unshift(standardVariant);
                this.oGModel.setProperty("/viewNames", uniqueVariants);

                // --- Assign variant model to control ---
                const variantModel = new sap.ui.model.json.JSONModel({ items12: uniqueVariants });
                oVariantMgmt.setModel(variantModel, "viewDetails");

                // --- Determine active key ---
                const newVariantFlag = this.oGModel.getProperty("/newVaraintFlag");
                const newVariant = this.oGModel.getProperty("/newVariant");
                let selectedKey = "0"; // default: Standard

                if (newVariantFlag === "X" && newVariant?.length) {
                    selectedKey = newVariant[0].VARIANTID;
                    this.oGModel.setProperty("/newVaraintFlag", "");
                    this.handleSelectPress(newVariant[0].VARIANTNAME);
                } else if (defaultVariantName) {
                    const defItem = uniqueVariants.find(v => v.VARIANTNAME === defaultVariantName);
                    if (defItem) {
                        selectedKey = defItem.VARIANTID;
                        this.handleSelectPress(defaultVariantName);
                    }
                } else {
                    this.handleSelectPress("Standard");
                }

                // --- Update variant management selection ---
                this.UniqueDefKey = selectedKey;
                oVariantMgmt.setDefaultKey(selectedKey);
                oVariantMgmt.setSelectedKey(selectedKey);

                // sap.m.MessageToast.show("Variants loaded successfully");

            } catch (err) {
                console.error("Error in getTotalVariantDetails:", err);
                sap.m.MessageToast.show("Error while loading variant details");
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },
        removeDuplicate: function (array, key) {
            var check = new Set();
            return array.filter(
                (obj) => !check.has(obj[key]) && check.add(obj[key])
            );
        },

        onCreate: async function (oEvent) {
            sap.ui.core.BusyIndicator.show();

            try {
                const sLocation = this.byId("LocationSelect").getSelectedKey();
                const sProduct = this.byId("productSelect").getSelectedKey();

                if (!sLocation && !sProduct) {
                    sap.m.MessageToast.show("No values selected in filters Location & Product");
                    return;
                }

                const appName = this.getOwnerComponent().getManifestEntry("/sap.app/id");
                const varName = oEvent.getParameters().name;
                const sDefault = oEvent.getParameters().def ? "Y" : "N";
                const sScope = oEvent.getParameters().public ? "Public" : "Private";
                const flag = oEvent.getParameters().overwrite ? "E" : "X";

                // Capture current panel visibility
                const bAlerts = this.byId("alertsPanel").getVisible();
                const bLags = this.byId("lagsPanel").getVisible();
                const bForecast = this.byId("idRow4").getVisible();

                // Build payload
                const dataArray = [];
                if (sLocation) dataArray.push({ Field: "Location", FieldCenter: "1", Value: sLocation, Default: sDefault });
                if (sProduct) dataArray.push({ Field: "Product", FieldCenter: "1", Value: sProduct });
                dataArray.push({ Field: "ALERTS_VISIBLE", FieldCenter: "1", Value: String(bAlerts) });
                dataArray.push({ Field: "LAGS_VISIBLE", FieldCenter: "1", Value: String(bLags) });
                dataArray.push({ Field: "WOW_VISIBLE", FieldCenter: "1", Value: String(bForecast) });
                if (flag === "X") {
                    dataArray.forEach(d => {
                        d.IDNAME = varName;
                        d.App_Name = appName;
                        d.SCOPE = sScope;
                    });
                }
                else if (flag === "E") {
                    dataArray.forEach(d => {
                        d.ID = oEvent.getParameters().key
                        d.IDNAME = varName;
                        d.App_Name = appName;
                        d.SCOPE = sScope;
                    });
                }

                // === Execute CAP function ===
                const oFunction = this.oModel.bindContext("/createVariantPlanner(...)");
                oFunction.setParameter("Flag", flag);
                oFunction.setParameter("USER", this.oGModel.getProperty("/UserId"));
                oFunction.setParameter("VARDATA", JSON.stringify(dataArray));

                await oFunction.execute();
                const oCtx = oFunction.getBoundContext();
                if (!oCtx) {
                    sap.m.MessageToast.show("No response received from backend");
                    return;
                }

                const oResult = oCtx.getObject();
                console.log("📦 createVariantPlanner response:", oResult); // debug once

                let value = JSON.parse(oResult.value);
                if (value.length > 0) {
                    this.oGModel.setProperty("/newVariant", value);
                    this.oGModel.setProperty("/newVaraintFlag", "X");
                    this.byId("idMatListVPD").setModified(false);
                    that.onResetData();
                    this.getVariantData()
                    sap.m.MessageToast.show("Variant created successfully");
                }
                else {
                    sap.m.MessageToast.show("Failed to create variant");
                }

            } catch (err) {
                console.error("❌ Variant creation failed:", err);
                sap.m.MessageToast.show("Failed to create variant");
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },

        onManage: async function (oEvent) {
            sap.ui.core.BusyIndicator.show();

            const totalVariantData = this.oGModel.getProperty("/VariantData");
            const selected = oEvent.getParameters();
            const variantUser = this.oGModel.getProperty("/UserId");

            try {
                // Deleted Variants
                if (selected.deleted?.length) {
                    const deletedArray = totalVariantData
                        .filter(item => selected.deleted.includes(String(item.VARIANTID)))
                        .map(item => ({ ID: item.VARIANTID, NAME: item.VARIANTNAME }));

                    if (deletedArray.length) {
                        const delFunc = this.oModel.bindContext("/createVariantPlanner(...)");
                        delFunc.setParameter("Flag", "D");
                        delFunc.setParameter("USER", variantUser);
                        delFunc.setParameter("VARDATA", JSON.stringify(deletedArray));
                        await delFunc.execute();
                    }
                }

                // Update default variant
                if (selected.def) {
                    const defId = JSON.parse(selected.def);
                    const isStandard = defId === 0;

                    if (!isStandard) {
                        const defFunc = this.oModel.bindContext("/updateVariantPlanner(...)");
                        const newDefault = totalVariantData
                            .filter(item => item.VARIANTID === defId)
                            .map(v => ({ ...v, DEFAULT: "Y" }));

                        defFunc.setParameter("VARDATA", JSON.stringify(newDefault));
                        await defFunc.execute();
                    }
                }
                this.onResetData();
                this.getVariantData();

            } catch (err) {
                console.error("Error managing variants", err);
                sap.m.MessageToast.show("Failed to manage variants");
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },
        handleSelectPress: async function (oEvent) {
            sap.ui.core.BusyIndicator.show();

            try {
                const oVariantDetails = this.oGModel.getProperty("/variantDetails") || [];
                const appName = this.getOwnerComponent().getManifestEntry("/sap.app/id");
                const oView = this.getView();

                let selectedVariantName =
                    typeof oEvent === "string"
                        ? oEvent
                        : oEvent?.getSource?.().getTitle?.().getText?.() || "Standard";

                this.oGModel.setProperty("/variantName", selectedVariantName);
                this.finaloTokens = [];
                this.oGModel.setProperty("/defaultLocation", '');
                this.oGModel.setProperty("/defaultProduct", '');
                this.oGModel.setProperty("/defaultWidgets", []);

                // --- Standard Variant (reset to default UI) ---
                if (selectedVariantName === "Standard") {
                    ["alertsPanel", "lagsPanel", "idRow4"].forEach(id =>
                        oView.byId(id).setVisible(true)
                    );
                    var object = {};
                    object.ID = 1;
                    object.Name = "Alerts";
                    that._aSelectedWidgets.push(object);
                    var object = {};
                    object.ID = 2;
                    object.Name = "Forecast Accuracy";
                    that._aSelectedWidgets.push(object);
                    var object = {};
                    object.ID = 3;
                    object.Name = "WoW Variance";
                    that._aSelectedWidgets.push(object);
                    return;
                }

                // --- Fetch matching variant data ---
                const filteredData = oVariantDetails.filter(item =>
                    item.VARIANTNAME === selectedVariantName &&
                    item.APPLICATION_NAME === appName
                );

                // --- Filters ---
                const locData = filteredData.filter(f => f.FIELD === "Location");
                const prodData = filteredData.filter(f => f.FIELD === "Product");

                // --- Panel visibility ---
                const alertsVisible = filteredData.find(f => f.FIELD === "ALERTS_VISIBLE")?.VALUE === "true";
                const lagsVisible = filteredData.find(f => f.FIELD === "LAGS_VISIBLE")?.VALUE === "true";
                const wowVisible = filteredData.find(f => f.FIELD === "WOW_VISIBLE")?.VALUE === "true";
                if (alertsVisible) {
                    var object = {};
                    object.ID = 1;
                    object.Name = "Alerts";
                    that._aSelectedWidgets.push(object);
                }
                if (lagsVisible) {
                    var object = {};
                    object.ID = 2;
                    object.Name = "Forecast Accuracy";
                    that._aSelectedWidgets.push(object);
                }
                if (wowVisible) {
                    var object = {};
                    object.ID = 3;
                    object.Name = "WoW Variance Analysis";
                    that._aSelectedWidgets.push(object);
                }
                this.oGModel.setProperty("/defaultWidgets", that._aSelectedWidgets);
                oView.byId("alertsPanel").setVisible(alertsVisible ?? true);
                oView.byId("lagsPanel").setVisible(lagsVisible ?? true);
                oView.byId("idRow4").setVisible(wowVisible ?? true);

                // --- Apply filters ---
                if (locData.length) {
                    const sLocValue = locData[0].VALUE;
                    oView.byId("LocationSelect").setSelectedKey(sLocValue);
                    this.oGModel.setProperty("/defaultLocation", sLocValue);
                    oView.byId("LocationSelect").fireSelectionChange();
                }

                if (prodData.length) {
                    const sProdValue = prodData[0].VALUE;
                    oView.byId("productSelect").setSelectedKey(sProdValue);
                    this.oGModel.setProperty("/defaultProduct", sProdValue);
                }

                // sap.m.MessageToast.show(`Loaded Variant: ${selectedVariantName}`);

            } catch (err) {
                console.error("Error applying variant", err);
                sap.m.MessageToast.show("Error applying selected variant");
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },




    });
});

