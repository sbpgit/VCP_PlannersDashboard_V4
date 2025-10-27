sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../model/formatter"
], (Controller, JSONModel, MessageToast, MessageBox, Filter,
    FilterOperator, formatter) => {
    "use strict";
    var that;
    return Controller.extend("vcp.vcplannerdashboard.controller.View1", {
        formatter: formatter,
        onInit: function () {
            this.oModel = this.getOwnerComponent().getModel();
            this.data = [];
            this.locationData = [];
            this.prodData = [];
            var sRootPath = jQuery.sap.getModulePath("vcp/vcplannerdashboard", "/");
            this.byId("idHeaderImage").setSrc(sRootPath + "image/logo.png");
            // this.loadAlertsCards();
        },

        onAfterRendering: function () {
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
            this.getLocProd();
            this._showEmptyAlertsCard("Assembly Lag Analysis", "idWFModel");
            this._showEmptyAlertsCard("Characteristic Percentage", "MyCardIdChar");
            this._showEmptyAlertsCard("ForecastActual & Forecast", "MyCardIdFore");
            this.loadAlertsCards();
            setTimeout(function () {
                // this.loadAlertsCards();
            }.bind(this), 1000);
        },
        // v4 oData
        getLocProd: function () {
            this.oModel.bindList("/getfactorylocdesc")
                .requestContexts()
                .then((aContexts) => {
                    const results = aContexts.map(oContext => oContext.getObject());

                    if (results?.length > 0) {
                        that.oGModel.setProperty("/fullLocProdData", results);
                        this.processData(results);
                    } else {
                        sap.m.MessageToast.show("No data available for Locations and Products");
                    }

                    sap.ui.core.BusyIndicator.hide();
                })
                .catch((oError) => {
                    sap.ui.core.BusyIndicator.hide();
                    console.error("Read failed:", oError);
                    sap.m.MessageBox.error("Failed to load data: " + oError.message);
                });
        },

        processData: function (results) {
            // Remove duplicates and sort
            this.locationData = this.removeDuplicates(results, "DEMAND_LOC");
            this.locationData.sort((a, b) => a.DEMAND_DESC.localeCompare(b.DEMAND_DESC));

            this.prodData = this.removeDuplicates(results, "PRODUCT_ID");
            this.prodData.sort((a, b) => a.PROD_DESC.localeCompare(b.PROD_DESC));

            // Set models
            this.getView().setModel(
                new sap.ui.model.json.JSONModel({ results1: this.locationData }),
                "locModel"
            );
            this.getView().setModel(
                new sap.ui.model.json.JSONModel({ results2: this.prodData }),
                "prodModel"
            );

            // Clear selections
            this.byId("LocationSelect").setSelectedKey("");
            this.byId("productSelect").setSelectedKey("");

            // Load cards
            this._loadForecastCard();
            // this.loadProcessAlertsCard();
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

        // -------------------
        // Load Forecast Data
        // -------------------
        _loadForecastCard: function () {
            const oModel = this.getOwnerComponent().getModel();
            const oCard = this.byId("MyCardId2");
            if (oCard) oCard.setBusy(true);
            if (!oModel) {
                console.error("OData model not available");
                return;
            }

            // Get selected keys
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

            // sap.ui.core.BusyIndicator.show();
            try {
                // Use bindList with filters, similar to your working example
                oModel.bindList("/getForecastSnapshotLag", null, [], aFilters)
                    .requestContexts()
                    .then((aContexts) => {
                        const results = aContexts.map(oContext => oContext.getObject());

                        if (Array.isArray(results) && results.length > 0) {
                            const chartData = this._prepareChartData(results);
                            const oManifest = this._buildCardManifest(
                                chartData,
                                "Forecast Snapshot Lag Analysis",
                                "Forecast",
                                results
                            );
                            this._applyCardManifest("MyCardId2", oManifest);
                        } else {
                            console.warn("No forecast data found for selected filters");
                            // sap.m.MessageToast.show("No forecast data available");
                            this._showEmptyAlertsCard("Forecast Snapshot Lag Analysis", "MyCardId2")
                        }

                        // sap.ui.core.BusyIndicator.hide();
                    })
                // .catch((oError) => {
                //     // sap.ui.core.BusyIndicator.hide();
                //     console.error("Forecast data request failed:", oError);
                //     sap.m.MessageBox.error("Failed to load forecast data: " + (oError.message || "Unknown error"));
                // });
            } catch (error) {
                sap.m.MessageBox.error("Failed to load forecast data: " + (error.message || "Unknown error"));
            } finally {
                if (oCard) oCard.setBusy(false);
            }
        },


        // -------------------
        // Load Assembly Data
        // -------------------
        _loadAssemblyCard: function () {
            const oModel = this.getOwnerComponent().getModel();

            if (!oModel) {
                console.error("OData model not available");
                return;
            }

            const locSelectedKeyAsmb = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKeyAsmb = this.byId("productSelect").getSelectedKey();

            const aFilters = [];

            // Add filters only if values are selected
            if (locSelectedKeyAsmb) {
                aFilters.push(new sap.ui.model.Filter("LOCATION_ID", "EQ", locSelectedKeyAsmb));
            }

            if (prodSelectedKeyAsmb) {
                aFilters.push(new sap.ui.model.Filter("PRODUCT_ID", "EQ", prodSelectedKeyAsmb));
            }

            sap.ui.core.BusyIndicator.show();

            // OData V4 approach using bindContext
            const oBindingContext = oModel.bindContext("/getAssemblySnapshotLag", null, {
                filters: aFilters.length > 0 ? aFilters : undefined,
                operationMode: "Server"
            });

            oBindingContext.requestObject()
                .then((oData) => {
                    // OData V4 returns data in 'value' property
                    const results = oData.value || [];
                    if (results.length > 0) {
                        const chartData = this._prepareChartData(results);
                        const oManifest = this._buildCardManifest(
                            chartData,
                            "Assembly Snapshot Lag Analysis",
                            "Assembly",
                            results
                        );
                        this._applyCardManifest("MyCardId2", oManifest);
                    }
                    else {
                        this._showEmptyAlertsCard("Assembly Lag snapshot analysis", "MyCardId2")
                    }

                    sap.ui.core.BusyIndicator.hide();
                })
                .catch((oError) => {
                    sap.ui.core.BusyIndicator.hide();
                    console.error("Read failed for assembly:", oError);
                    sap.m.MessageBox.error("Failed to load assembly data: " + (oError.message || "Unknown error"));
                });
        },

        // -------------------
        // Utility: transform data into chart format
        // -------------------
        _prepareChartData: function (aResults) {
            if (!aResults || aResults.length === 0) return [];

            var periodMap = {};
            aResults.forEach(function (item) {
                var period = item.YEAR_MONTH;
                if (!periodMap[period]) {
                    periodMap[period] = {
                        period: period,
                        lag1Values: [], lag2Values: [], lag3Values: [],
                        lag4Values: [], lag5Values: []
                    };
                }
                if (item.LAG1_CIR != null) periodMap[period].lag1Values.push(parseFloat(item.LAG1_CIR));
                if (item.LAG2_CIR != null) periodMap[period].lag2Values.push(parseFloat(item.LAG2_CIR));
                if (item.LAG3_CIR != null) periodMap[period].lag3Values.push(parseFloat(item.LAG3_CIR));
                if (item.LAG4_CIR != null) periodMap[period].lag4Values.push(parseFloat(item.LAG4_CIR));
                if (item.LAG5_CIR != null) periodMap[period].lag5Values.push(parseFloat(item.LAG5_CIR));
            });

            var chartData = [];
            Object.keys(periodMap).sort().forEach(function (period) {
                var data = periodMap[period];
                chartData.push({
                    period: period,
                    lag1: data.lag1Values.length ? data.lag1Values.reduce((a, b) => a + b, 0) / data.lag1Values.length : 0,
                    lag2: data.lag2Values.length ? data.lag2Values.reduce((a, b) => a + b, 0) / data.lag2Values.length : 0,
                    lag3: data.lag3Values.length ? data.lag3Values.reduce((a, b) => a + b, 0) / data.lag3Values.length : 0,
                    lag4: data.lag4Values.length ? data.lag4Values.reduce((a, b) => a + b, 0) / data.lag4Values.length : 0,
                    lag5: data.lag5Values.length ? data.lag5Values.reduce((a, b) => a + b, 0) / data.lag5Values.length : 0
                });
            });

            return chartData;
        },

        // -------------------
        // Utility: build card manifest
        // -------------------
        _buildCardManifest: function (chartData, sTitle, sSelected, oData) {
            return {
                "sap.app": {
                    "id": "vcp.v4card.forecast",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": {
                    "technology": "UI5",
                    "deviceTypes": { "desktop": true, "tablet": true, "phone": true }
                },
                "sap.card": {
                    "type": "Analytical",
                    "data": { "json": chartData },
                    "header": {
                        "type": "Numeric",
                        "title": sTitle,
                        "subTitle": "Comparison across lag periods",
                        "mainIndicator": {
                            "number": chartData.length,
                            "unit": "Periods",
                            "state": "Good"
                        },
                        "sideIndicators": [
                            { "title": "Total Records", "number": oData.length, "unit": "Records" },
                            { "title": "Unique Periods", "number": chartData.length, "unit": "Months" }
                        ]
                    },
                    "configuration": {
                        "filters": {
                            "Lag": {
                                "type": "ComboBox",
                                "label": "Dataset",
                                "value": sSelected, // either "Forecast" or "Assembly"
                                "item": {
                                    "path": "/",
                                    "template": {
                                        "key": "{text}",
                                        "title": "{text}"
                                    }
                                },
                                "data": {
                                    "json": [
                                        { "text": "Forecast" },
                                        { "text": "Assembly" }
                                    ]
                                }
                            }
                        }
                    },
                    "content": {
                        "chartType": "column",
                        "title": { "text": sTitle },
                        "legend": { "visible": true },
                        "data": { "path": "/" },
                        "dimensions": [
                            { "label": "Period", "value": "{period}" }
                        ],
                        "measures": [
                            { "label": "Lag 1", "value": "{lag1}" },
                            { "label": "Lag 2", "value": "{lag2}" },
                            { "label": "Lag 3", "value": "{lag3}" },
                            { "label": "Lag 4", "value": "{lag4}" },
                            { "label": "Lag 5", "value": "{lag5}" }
                        ],
                        "feeds": [
                            { "uid": "categoryAxis", "type": "Dimension", "values": ["Period"] },
                            { "uid": "valueAxis", "type": "Measure", "values": ["Lag 1", "Lag 2", "Lag 3", "Lag 4", "Lag 5"] }
                        ]
                    }
                }
            };
        },
        // -------------------
        // Event: filter change
        // -------------------
        onFilterChange: function (oEvent) {
            var mChanges = oEvent.getParameters().changes;
            if (mChanges && mChanges["/sap.card/configuration/filters/Lag/value"]) {
                var selected = mChanges["/sap.card/configuration/filters/Lag/value"];
                console.log("Dropdown changed:", selected);

                if (selected === "Forecast") {
                    this._loadForecastCard();
                } else if (selected === "Assembly") {
                    this._loadAssemblyCard();
                }
            }
        },
        // -------------------
        // Utility: apply manifest and attach filter change
        // -------------------
        _applyCardManifest: function (sCardId, oManifest) {
            var oCard = this.byId(sCardId);
            if (oCard) {
                oCard.setManifest(oManifest);

                // attach configurationChange instead of filterChange
                oCard.detachConfigurationChange(this.onFilterChange, this);
                oCard.attachConfigurationChange(this.onFilterChange, this);
            }
            sap.ui.core.BusyIndicator.hide();
        },
        onLocationChange: function () {
            var selectedData = this.byId("LocationSelect").getSelectedKey();
            var filteredProdData = this.prodData.filter(a => a.DEMAND_LOC === selectedData);
            var oJSONProduct = new sap.ui.model.json.JSONModel({ results2: filteredProdData });
            this.getView().setModel(oJSONProduct, "prodModel");
        },
        onGetData: function () {
            this._loadForecastCard();
            this.loadAlertsCards();
            this._loadWFCard();
            this._loadCharCards();
        },
        onResetData: function () {
            sap.ui.core.BusyIndicator.show();
            this.onAfterRendering();
        },


        // Refresh method to reload alert data
        onRefreshAlerts: function () {

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
                    that._setEmptyAlertCards();
                }
            }).catch(function (oError) {
                console.error("[V4 Alerts] Error loading data:", oError);
                that._setEmptyAlertCards();
            });
        },


        // V4 OData data processing with all three cards
        _processAlertsDataV4: function (oData) {
            var that = this;

            // Normalize incoming V4 payload
            var results = [];
            try {
                results = Array.isArray(oData) ? oData : (oData.value || []);
            } catch (e) {
                console.error("[V4 Alerts] Error parsing data:", e);
                results = [];
            }

            console.log("[V4 Alerts] raw results length:", results.length);

            if (!results || results.length === 0) {
                console.warn("[V4 Alerts] No alerts -> show empty cards");
                that._setEmptyAlertCards();
                return;
            }

            // Keep only VCPLANNER alerts
            var vcAlerts = results.filter(function (it) {
                return it && it.APPL === "VCPLANNER";
            });

            if (vcAlerts.length === 0) {
                that._setEmptyAlertCards();
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
                return a.MSGGRP === "DATA";
            });

            // EXCEPTIONAL ALERTS: Only MSGGRP = "EXCEPTIONAL"
            var interfaceAlerts = vcAlerts.filter(function (a) {
                return a.MSGGRP === "INTERFACE";
            });

            console.log("[V4 Alerts] Filtered - Data:", dataAlerts.length, "System:", systemAlerts.length, "Exception:", exceptionalAlerts.length);

            // Process DATA ALERTS card data - show individual messages
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
                return {
                    category: group,
                    count: data.count,
                    success: data.success,
                    warning: data.warning,
                    error: data.error,
                    icon: that._getSystemGroupIcon(group),
                    severity: that._determineSystemSeverity(data.success, data.warning, data.error)
                };
            }).filter(function (item) {
                return item.count > 0; // Only show groups with alerts
            });

            // Process EXCEPTIONAL ALERTS card data - show individual messages
            var exceptionalAlertsCardData = exceptionalAlerts.map(function (a, idx) {
                return {
                    id: a.PROCESS_ID || a.MSGID || ("exceptional-" + idx),
                    title: a.MSGTXT || "Exception alert",
                    description: a.ADDL_INFO || "",
                    // icon: "sap-icon://alert",
                    severity: that._determineExceptionalSeverity(a.MSGTXT)
                };
            });

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

            } catch (error) {
                console.error("[V4 Alerts] Error binding cards:", error);
                that._setEmptyAlertCards();
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
                        "subTitle": "Process, Interface & Restriction Status",
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
                                "value": "✓ {success} ⚠ {warning} ✗ {error}",
                                "state": "{= ${error} > 0 ? 'Error' : ${warning} > 0 ? 'Warning' : 'Success' }",

                            },

                            "actions": [
                                {
                                    "type": "Custom",
                                    "parameters": {
                                        // "url": "{targetApp}",
                                        // "target": "_blank",
                                        "actionId": "{category}"
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
                            "width" : "70px"
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
                            "pageSize": 7
                        }
                    }
                }
            };
        },
        _getTargetForCategory: async function (category) {
            try {
                // ✅ Use async version to get the service
                const oCrossAppNavigator = await sap.ushell.Container.getServiceAsync("CrossApplicationNavigation");
                let sIntent;

                switch (category) {
                    case "PROCESS_JOBS":
                        sIntent = await oCrossAppNavigator.hrefForExternalAsync({
                            target: {
                                semanticObject: "jobschedulersequence",
                                action: "display"
                            }
                        });
                        break;

                    case "INTERFACE":
                        sIntent = await oCrossAppNavigator.hrefForExternalAsync({
                            target: {
                                semanticObject: "vcpappvcpinterface",
                                action: "Display"
                            }
                        });
                        break;

                    default:
                        sIntent = "#Shell-home";
                        break;
                }

                return sIntent;

            } catch (err) {
                console.error("Error while generating intent:", err);
                return "#Shell-home";
            }
        }
        ,


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
                            // "icon": { "src": "{icon}" },
                            "highlight": "{severity}"
                            // "info": {
                            //     "value": "{severity}",
                            //     "state": "{= ${severity} === 'High' ? 'Error' : ${severity} === 'Medium' ? 'Warning' : 'Information' }"
                            // }
                        }
                    },
                    "footer": {
                        "paginator": {
                            "pageSize": 7
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
                            // "icon": { "src": "{icon}" },
                            "highlight": "{severity}"
                        }
                    },
                    "footer": {
                        "paginator": {
                            "pageSize": 7
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
                || lowerMessage.includes('yes') || lowerMessage.includes('changed')) {
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
            var oInterfaceCard = that.byId("MyCardId4")

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
                    var oStorage = jQuery.sap.storage(jQuery.sap.storage.Type.local);
                    oStorage.put("nodeId", 58);
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
                    var oStorage = jQuery.sap.storage(jQuery.sap.storage.Type.local);
                    oStorage.put("nodeId", 58);
                    //Generate a  URL for the second application
                    var url = window.location.href.split('#')[0] + hash;
                    //Navigate to second app
                    sap.m.URLHelper.redirect(url, true);
                }
            } catch (err) {
                console.error("Failed to navigate to Interface:", err);
            }
        },
        _loadWFCard: function (facloc, assembly, month) {
            const oModel = this.getOwnerComponent().getModel();
            const oCard = this.byId("idWFModel");
            if (oCard) oCard.setBusy(true);
            if (!oModel) {
                console.error("OData model not available");
                return;
            }

            // Get selected keys
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();

            var fullData = that.oGModel.getProperty("/fullLocProdData");
            var factoryLocData = fullData.filter(id => id.DEMAND_LOC === locSelectedKey && id.PRODUCT_ID === prodSelectedKey);
            var faclocManifest = {
                "sap.app": {
                    "id": "vcp.v4card.mapeWaterfall",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": { "technology": "UI5" },
                "sap.card": {
                    "type": "Analytical",
                    "data": {
                        // 👇 Dummy data so the card initializes its data binding
                        "json": [{ "FACTORY_LOC": "1600" }]
                    },
                    "header": {
                        "title": "Assembly Lag",
                        "subTitle": "MAPE across Lag Months",
                        "titleMaxLines": 1,
                        "subTitleMaxLines": 1,

                    },
                    "configuration": {
                        "maxFiltersInSingleLine": 0,
                        "filters": {
                            "FactoryLoc": {
                                "type": "ComboBox",
                                "label": "Dataset",
                                "value": "",
                                "placeholder": "Factory Location",
                                "item": {
                                    "path": "/",
                                    "template": {
                                        "key": "{FACTORY_LOC}",
                                        "title": "{FACTORY_LOC}"
                                    }
                                },
                                "data": {
                                    // 👇 Make sure this dataset is non-empty too
                                    "json": factoryLocData && factoryLocData.length ? factoryLocData : [
                                        { "FACTORY_LOC": "1600" },
                                        { "FACTORY_LOC": "1700" }
                                    ]
                                }
                            }
                        }
                    },
                    "content": {
                        "chartType": "waterfall",
                        "title": { "text": "" },
                        "legend": { "visible": false },
                        "plotArea": { "dataLabel": { "visible": true } },
                        "data": { "path": "/" },
                        "dimensions": [
                            { "label": "Period", "value": "{}" }
                        ],
                        "measures": [
                            { "label": "Lag 1", "value": "{}" }
                        ],
                        "feeds": [
                            { "uid": "categoryAxis", "type": "Dimension", "values": [] },
                            { "uid": "valueAxis", "type": "Measure", "values": [] }
                        ]
                    }
                }
            };

            oCard.setManifest(faclocManifest);
            oCard.detachConfigurationChange(this.onFilterChangeWF, this);
            oCard.attachConfigurationChange(this.onFilterChangeWF, this);
            oCard.setBusy(false)
        },
        onFilterChangeWF: function (oEvent) {
            var mChanges = oEvent.getParameters().changes;
            if (mChanges) {
                if (Object.keys(mChanges).some(key => key.includes("FactoryLoc"))) {
                    var selected = mChanges["/sap.card/configuration/filters/FactoryLoc/value"];

                }
            }
        },
        _loadCharCards: function () {
            const oModel = this.getOwnerComponent().getModel();
            const oCard = this.byId("idWFModel");
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

            // try {
            //     sap.ui.core.BusyIndicator.show(0);

            //     oModel.bindList("/getDemandAndForecast", null, [], aFilters1)
            //         .requestContexts(0, 10000)
            //         .then((aContexts) => {
            //             var results = aContexts.map(oContext => oContext.getObject());
            //             if (results.length) {
            //                 results = results.slice(0, 100);
            //                 results = results.map(e => ({
            //                     WEEK_CHAR: `${e.WEEK_DATE} / ${e.CHAR_DESC}`,
            //                     PERCENTAGE: Number(e.PERCENTAGE),
            //                     FORECAST_SALES_PERCENTAGE: Number(e.FORECAST_SALES_PERCENTAGE)
            //                 }));
            //                 this._setCharAnalysisCard(results);
            //             } else {
            //                 sap.m.MessageToast.show("No data available for Locations and Products");
            //             }
            //         })
            //         .catch((oError) => {
            //             console.error("Read failed:", oError);
            //             sap.m.MessageBox.error("Failed to load data: " + oError.message);
            //         })
            //         .finally(() => sap.ui.core.BusyIndicator.hide());

            // } catch (err) {
            //     sap.ui.core.BusyIndicator.hide();
            //     console.error("bindList failed:", err);
            // }

            // oModel.bindList("/getDMDForecast", null, [], aFilters)
            //     .requestContexts(0, 10000)
            //     .then((aContexts) => {
            //         var results = aContexts.map(oContext => oContext.getObject());

            //         if (results?.length > 0) {
            //             results = results.slice(0, 100);
            //             const chartData = results.map(e => ({
            //                 WEEK_DATE: e.WEEK_DATE, // X-axis (category)
            //                 FORECAST_QTY: Number(e.QUANTITY) || 0,
            //                 ACTUAL_QTY: Number(e.ACTUAL_QTY) || 0
            //             }));
            var chartData = [{ "LOCATION_ID": 1600, "PRODUCT_ID": "SCHAR_M", "UNIQUE_ID": 6897, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "SINGLE CHAR PRODUCT", "WEEK_DATE": "2025-06-02", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/06/06", "QUARTER": "FY26 Q2", "MONTH": "FY26 P04", "YEAR_MONTH": "2025-06", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 33, "ABS_DIFF": -32, "PERCENT_DIFF": 0.9696969696969697, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "SCHAR_M", "UNIQUE_ID": 6897, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "SINGLE CHAR PRODUCT", "WEEK_DATE": "2025-06-02", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/06/06", "QUARTER": "FY26 Q2", "MONTH": "FY26 P04", "YEAR_MONTH": "2025-06", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 33, "ABS_DIFF": -32, "PERCENT_DIFF": 0.9696969696969697, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "SCHAR_M", "UNIQUE_ID": 6897, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "SINGLE CHAR PRODUCT", "WEEK_DATE": "2025-06-02", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/06/06", "QUARTER": "FY26 Q2", "MONTH": "FY26 P04", "YEAR_MONTH": "2025-06", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 33, "ABS_DIFF": -32, "PERCENT_DIFF": 0.9696969696969697, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "SCHAR_M", "UNIQUE_ID": 6893, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "SINGLE CHAR PRODUCT", "WEEK_DATE": "2025-06-16", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/06/20", "QUARTER": "FY26 Q2", "MONTH": "FY26 P04", "YEAR_MONTH": "2025-06", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 9, "FORECAST_QTY": 33, "ABS_DIFF": -24, "PERCENT_DIFF": 0.7272727272727273, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "SCHAR_M", "UNIQUE_ID": 6893, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "SINGLE CHAR PRODUCT", "WEEK_DATE": "2025-06-16", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/06/20", "QUARTER": "FY26 Q2", "MONTH": "FY26 P04", "YEAR_MONTH": "2025-06", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 9, "FORECAST_QTY": 33, "ABS_DIFF": -24, "PERCENT_DIFF": 0.7272727272727273, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "SCHAR_M", "UNIQUE_ID": 6893, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "SINGLE CHAR PRODUCT", "WEEK_DATE": "2025-06-16", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/06/20", "QUARTER": "FY26 Q2", "MONTH": "FY26 P04", "YEAR_MONTH": "2025-06", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 9, "FORECAST_QTY": 33, "ABS_DIFF": -24, "PERCENT_DIFF": 0.7272727272727273, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_2700", "UNIQUE_ID": 4873, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "VCP 2700 Procedure", "WEEK_DATE": "2025-02-24", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/02/28", "QUARTER": "FY25 Q4", "MONTH": "FY25 P12", "YEAR_MONTH": "2025-02", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 1, "ABS_DIFF": 4, "PERCENT_DIFF": 4, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_2700", "UNIQUE_ID": 4873, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "VCP 2700 Procedure", "WEEK_DATE": "2025-02-24", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/02/28", "QUARTER": "FY25 Q4", "MONTH": "FY25 P12", "YEAR_MONTH": "2025-02", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 1, "ABS_DIFF": 4, "PERCENT_DIFF": 4, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_2700", "UNIQUE_ID": 4873, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "VCP 2700 Procedure", "WEEK_DATE": "2025-02-24", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/02/28", "QUARTER": "FY25 Q4", "MONTH": "FY25 P12", "YEAR_MONTH": "2025-02", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 1, "ABS_DIFF": 4, "PERCENT_DIFF": 4, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_2700", "UNIQUE_ID": 4875, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "VCP 2700 Procedure", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 7, "FORECAST_QTY": 1, "ABS_DIFF": 6, "PERCENT_DIFF": 6, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_2900", "UNIQUE_ID": 6314, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "VCP 2900 Procedure", "WEEK_DATE": "2025-05-19", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/23", "QUARTER": "FY26 Q1", "MONTH": "FY26 P03", "YEAR_MONTH": "2025-05", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 125, "ABS_DIFF": -123, "PERCENT_DIFF": 0.984, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_2900", "UNIQUE_ID": 6332, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "VCP 2900 Procedure", "WEEK_DATE": "2025-05-26", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/30", "QUARTER": "FY26 Q1", "MONTH": "FY26 P03", "YEAR_MONTH": "2025-05", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 126, "ABS_DIFF": -124, "PERCENT_DIFF": 0.9841269841269841, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_2900", "UNIQUE_ID": 6342, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "VCP 2900 Procedure", "WEEK_DATE": "2025-06-02", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/06/06", "QUARTER": "FY26 Q2", "MONTH": "FY26 P04", "YEAR_MONTH": "2025-06", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 126, "ABS_DIFF": -122, "PERCENT_DIFF": 0.9682539682539683, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_2900", "UNIQUE_ID": 6334, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "VCP 2900 Procedure", "WEEK_DATE": "2025-06-02", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/06/06", "QUARTER": "FY26 Q2", "MONTH": "FY26 P04", "YEAR_MONTH": "2025-06", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 126, "ABS_DIFF": -124, "PERCENT_DIFF": 0.9841269841269841, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_2900", "UNIQUE_ID": 6338, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "VCP 2900 Procedure", "WEEK_DATE": "2025-06-02", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/06/06", "QUARTER": "FY26 Q2", "MONTH": "FY26 P04", "YEAR_MONTH": "2025-06", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 126, "ABS_DIFF": -123, "PERCENT_DIFF": 0.9761904761904762, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6633, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 8, "ABS_DIFF": -3, "PERCENT_DIFF": 0.375, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6636, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 8, "ABS_DIFF": -3, "PERCENT_DIFF": 0.375, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6633, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 10, "ABS_DIFF": -5, "PERCENT_DIFF": 0.5, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6636, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 10, "ABS_DIFF": -5, "PERCENT_DIFF": 0.5, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6633, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 11, "ABS_DIFF": -6, "PERCENT_DIFF": 0.5454545454545454, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6636, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 11, "ABS_DIFF": -6, "PERCENT_DIFF": 0.5454545454545454, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6633, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 11, "ABS_DIFF": -6, "PERCENT_DIFF": 0.5454545454545454, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6636, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 11, "ABS_DIFF": -6, "PERCENT_DIFF": 0.5454545454545454, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6633, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 8, "ABS_DIFF": -3, "PERCENT_DIFF": 0.375, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6636, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 8, "ABS_DIFF": -3, "PERCENT_DIFF": 0.375, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6636, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 11, "ABS_DIFF": -6, "PERCENT_DIFF": 0.5454545454545454, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6633, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 11, "ABS_DIFF": -6, "PERCENT_DIFF": 0.5454545454545454, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6633, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 11, "ABS_DIFF": -6, "PERCENT_DIFF": 0.5454545454545454, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6636, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 11, "ABS_DIFF": -6, "PERCENT_DIFF": 0.5454545454545454, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6633, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 10, "ABS_DIFF": -5, "PERCENT_DIFF": 0.5, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6636, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 10, "ABS_DIFF": -5, "PERCENT_DIFF": 0.5, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6636, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 11, "ABS_DIFF": -6, "PERCENT_DIFF": 0.5454545454545454, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6633, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 11, "ABS_DIFF": -6, "PERCENT_DIFF": 0.5454545454545454, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6633, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 11, "ABS_DIFF": -6, "PERCENT_DIFF": 0.5454545454545454, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6636, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-14", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/18", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 5, "FORECAST_QTY": 11, "ABS_DIFF": -6, "PERCENT_DIFF": 0.5454545454545454, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6623, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 11, "ABS_DIFF": -7, "PERCENT_DIFF": 0.6363636363636364, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6631, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 11, "ABS_DIFF": -7, "PERCENT_DIFF": 0.6363636363636364, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6631, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 11, "ABS_DIFF": -7, "PERCENT_DIFF": 0.6363636363636364, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6623, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 11, "ABS_DIFF": -7, "PERCENT_DIFF": 0.6363636363636364, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6631, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 11, "ABS_DIFF": -7, "PERCENT_DIFF": 0.6363636363636364, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6631, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 10, "ABS_DIFF": -6, "PERCENT_DIFF": 0.6, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6623, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 10, "ABS_DIFF": -6, "PERCENT_DIFF": 0.6, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6631, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 11, "ABS_DIFF": -7, "PERCENT_DIFF": 0.6363636363636364, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6623, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 11, "ABS_DIFF": -7, "PERCENT_DIFF": 0.6363636363636364, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6623, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 11, "ABS_DIFF": -7, "PERCENT_DIFF": 0.6363636363636364, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6631, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 11, "ABS_DIFF": -7, "PERCENT_DIFF": 0.6363636363636364, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6623, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 11, "ABS_DIFF": -7, "PERCENT_DIFF": 0.6363636363636364, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6631, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 11, "ABS_DIFF": -7, "PERCENT_DIFF": 0.6363636363636364, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6623, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 11, "ABS_DIFF": -7, "PERCENT_DIFF": 0.6363636363636364, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6623, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 11, "ABS_DIFF": -7, "PERCENT_DIFF": 0.6363636363636364, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6623, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 10, "ABS_DIFF": -6, "PERCENT_DIFF": 0.6, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6631, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 11, "ABS_DIFF": -7, "PERCENT_DIFF": 0.6363636363636364, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6631, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 10, "ABS_DIFF": -6, "PERCENT_DIFF": 0.6, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6623, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 10, "ABS_DIFF": -6, "PERCENT_DIFF": 0.6, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6631, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-21", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/04/25", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 4, "FORECAST_QTY": 10, "ABS_DIFF": -6, "PERCENT_DIFF": 0.6, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6618, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 7, "ABS_DIFF": -5, "PERCENT_DIFF": 0.7142857142857143, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6901, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 7, "ABS_DIFF": -6, "PERCENT_DIFF": 0.8571428571428571, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6901, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 8, "ABS_DIFF": -7, "PERCENT_DIFF": 0.875, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6618, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 8, "ABS_DIFF": -6, "PERCENT_DIFF": 0.75, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6901, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 6, "ABS_DIFF": -5, "PERCENT_DIFF": 0.8333333333333334, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6901, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 6, "ABS_DIFF": -5, "PERCENT_DIFF": 0.8333333333333334, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6618, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 6, "ABS_DIFF": -4, "PERCENT_DIFF": 0.6666666666666666, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6618, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 8, "ABS_DIFF": -6, "PERCENT_DIFF": 0.75, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6901, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 8, "ABS_DIFF": -7, "PERCENT_DIFF": 0.875, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6618, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 10, "ABS_DIFF": -8, "PERCENT_DIFF": 0.8, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6901, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 10, "ABS_DIFF": -9, "PERCENT_DIFF": 0.9, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6901, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 9, "ABS_DIFF": -8, "PERCENT_DIFF": 0.8888888888888888, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6618, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 9, "ABS_DIFF": -7, "PERCENT_DIFF": 0.7777777777777778, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6901, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 9, "ABS_DIFF": -8, "PERCENT_DIFF": 0.8888888888888888, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6618, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 9, "ABS_DIFF": -7, "PERCENT_DIFF": 0.7777777777777778, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6901, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 8, "ABS_DIFF": -7, "PERCENT_DIFF": 0.875, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6618, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 8, "ABS_DIFF": -6, "PERCENT_DIFF": 0.75, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6901, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 35, "ABS_DIFF": -34, "PERCENT_DIFF": 0.9714285714285714, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6618, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 35, "ABS_DIFF": -33, "PERCENT_DIFF": 0.9428571428571428, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6618, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-04-28", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/02", "QUARTER": "FY26 Q1", "MONTH": "FY26 P02", "YEAR_MONTH": "2025-04", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 6, "ABS_DIFF": -4, "PERCENT_DIFF": 0.6666666666666666, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6620, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-05-26", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/30", "QUARTER": "FY26 Q1", "MONTH": "FY26 P03", "YEAR_MONTH": "2025-05", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 11, "ABS_DIFF": -8, "PERCENT_DIFF": 0.7272727272727273, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6620, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-05-26", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/30", "QUARTER": "FY26 Q1", "MONTH": "FY26 P03", "YEAR_MONTH": "2025-05", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 11, "ABS_DIFF": -8, "PERCENT_DIFF": 0.7272727272727273, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6620, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-05-26", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/30", "QUARTER": "FY26 Q1", "MONTH": "FY26 P03", "YEAR_MONTH": "2025-05", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 11, "ABS_DIFF": -8, "PERCENT_DIFF": 0.7272727272727273, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6620, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-05-26", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/30", "QUARTER": "FY26 Q1", "MONTH": "FY26 P03", "YEAR_MONTH": "2025-05", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 10, "ABS_DIFF": -7, "PERCENT_DIFF": 0.7, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6620, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-05-26", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/30", "QUARTER": "FY26 Q1", "MONTH": "FY26 P03", "YEAR_MONTH": "2025-05", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 10, "ABS_DIFF": -7, "PERCENT_DIFF": 0.7, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6620, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-05-26", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/30", "QUARTER": "FY26 Q1", "MONTH": "FY26 P03", "YEAR_MONTH": "2025-05", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 11, "ABS_DIFF": -8, "PERCENT_DIFF": 0.7272727272727273, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6620, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-05-26", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/30", "QUARTER": "FY26 Q1", "MONTH": "FY26 P03", "YEAR_MONTH": "2025-05", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 11, "ABS_DIFF": -8, "PERCENT_DIFF": 0.7272727272727273, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6620, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-05-26", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/30", "QUARTER": "FY26 Q1", "MONTH": "FY26 P03", "YEAR_MONTH": "2025-05", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 11, "ABS_DIFF": -8, "PERCENT_DIFF": 0.7272727272727273, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6620, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-05-26", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/30", "QUARTER": "FY26 Q1", "MONTH": "FY26 P03", "YEAR_MONTH": "2025-05", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 11, "ABS_DIFF": -8, "PERCENT_DIFF": 0.7272727272727273, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6620, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-05-26", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/05/30", "QUARTER": "FY26 Q1", "MONTH": "FY26 P03", "YEAR_MONTH": "2025-05", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 11, "ABS_DIFF": -8, "PERCENT_DIFF": 0.7272727272727273, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6627, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-06-30", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/04", "QUARTER": "FY26 Q2", "MONTH": "FY26 P04", "YEAR_MONTH": "2025-06", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 11, "ABS_DIFF": -9, "PERCENT_DIFF": 0.8181818181818182, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6627, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-06-30", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/04", "QUARTER": "FY26 Q2", "MONTH": "FY26 P04", "YEAR_MONTH": "2025-06", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 11, "ABS_DIFF": -9, "PERCENT_DIFF": 0.8181818181818182, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6627, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-06-30", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/04", "QUARTER": "FY26 Q2", "MONTH": "FY26 P04", "YEAR_MONTH": "2025-06", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 11, "ABS_DIFF": -9, "PERCENT_DIFF": 0.8181818181818182, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6627, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-06-30", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/04", "QUARTER": "FY26 Q2", "MONTH": "FY26 P04", "YEAR_MONTH": "2025-06", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 11, "ABS_DIFF": -9, "PERCENT_DIFF": 0.8181818181818182, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6627, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-06-30", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/04", "QUARTER": "FY26 Q2", "MONTH": "FY26 P04", "YEAR_MONTH": "2025-06", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 11, "ABS_DIFF": -9, "PERCENT_DIFF": 0.8181818181818182, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6627, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-06-30", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/04", "QUARTER": "FY26 Q2", "MONTH": "FY26 P04", "YEAR_MONTH": "2025-06", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 11, "ABS_DIFF": -9, "PERCENT_DIFF": 0.8181818181818182, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6627, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-06-30", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/04", "QUARTER": "FY26 Q2", "MONTH": "FY26 P04", "YEAR_MONTH": "2025-06", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 10, "ABS_DIFF": -8, "PERCENT_DIFF": 0.8, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6627, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-06-30", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/04", "QUARTER": "FY26 Q2", "MONTH": "FY26 P04", "YEAR_MONTH": "2025-06", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 11, "ABS_DIFF": -9, "PERCENT_DIFF": 0.8181818181818182, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6627, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-06-30", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/04", "QUARTER": "FY26 Q2", "MONTH": "FY26 P04", "YEAR_MONTH": "2025-06", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 11, "ABS_DIFF": -9, "PERCENT_DIFF": 0.8181818181818182, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6627, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-06-30", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/04", "QUARTER": "FY26 Q2", "MONTH": "FY26 P04", "YEAR_MONTH": "2025-06", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 2, "FORECAST_QTY": 11, "ABS_DIFF": -9, "PERCENT_DIFF": 0.8181818181818182, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6629, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-07-07", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/11", "QUARTER": "FY26 Q2", "MONTH": "FY26 P05", "YEAR_MONTH": "2025-07", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 8, "ABS_DIFF": -5, "PERCENT_DIFF": 0.625, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6629, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-07-07", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/11", "QUARTER": "FY26 Q2", "MONTH": "FY26 P05", "YEAR_MONTH": "2025-07", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 7, "ABS_DIFF": -4, "PERCENT_DIFF": 0.5714285714285714, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6629, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-07-07", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/11", "QUARTER": "FY26 Q2", "MONTH": "FY26 P05", "YEAR_MONTH": "2025-07", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 10, "ABS_DIFF": -7, "PERCENT_DIFF": 0.7, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6629, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-07-07", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/11", "QUARTER": "FY26 Q2", "MONTH": "FY26 P05", "YEAR_MONTH": "2025-07", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 9, "ABS_DIFF": -6, "PERCENT_DIFF": 0.6666666666666666, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6629, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-07-07", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/11", "QUARTER": "FY26 Q2", "MONTH": "FY26 P05", "YEAR_MONTH": "2025-07", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 7, "ABS_DIFF": -4, "PERCENT_DIFF": 0.5714285714285714, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6629, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-07-07", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/11", "QUARTER": "FY26 Q2", "MONTH": "FY26 P05", "YEAR_MONTH": "2025-07", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 8, "ABS_DIFF": -5, "PERCENT_DIFF": 0.625, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6629, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-07-07", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/11", "QUARTER": "FY26 Q2", "MONTH": "FY26 P05", "YEAR_MONTH": "2025-07", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 36, "ABS_DIFF": -33, "PERCENT_DIFF": 0.9166666666666666, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6629, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-07-07", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/11", "QUARTER": "FY26 Q2", "MONTH": "FY26 P05", "YEAR_MONTH": "2025-07", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 9, "ABS_DIFF": -6, "PERCENT_DIFF": 0.6666666666666666, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6629, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-07-07", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/11", "QUARTER": "FY26 Q2", "MONTH": "FY26 P05", "YEAR_MONTH": "2025-07", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 8, "ABS_DIFF": -5, "PERCENT_DIFF": 0.625, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6629, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-07-07", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/07/11", "QUARTER": "FY26 Q2", "MONTH": "FY26 P05", "YEAR_MONTH": "2025-07", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 3, "FORECAST_QTY": 6, "ABS_DIFF": -3, "PERCENT_DIFF": 0.5, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6625, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-09-01", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/09/05", "QUARTER": "FY26 Q3", "MONTH": "FY26 P07", "YEAR_MONTH": "2025-09", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 9, "ABS_DIFF": -8, "PERCENT_DIFF": 0.8888888888888888, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6625, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-09-01", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/09/05", "QUARTER": "FY26 Q3", "MONTH": "FY26 P07", "YEAR_MONTH": "2025-09", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 11, "ABS_DIFF": -10, "PERCENT_DIFF": 0.9090909090909091, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6625, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-09-01", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/09/05", "QUARTER": "FY26 Q3", "MONTH": "FY26 P07", "YEAR_MONTH": "2025-09", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 11, "ABS_DIFF": -10, "PERCENT_DIFF": 0.9090909090909091, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6625, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-09-01", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/09/05", "QUARTER": "FY26 Q3", "MONTH": "FY26 P07", "YEAR_MONTH": "2025-09", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 11, "ABS_DIFF": -10, "PERCENT_DIFF": 0.9090909090909091, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6625, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-09-01", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/09/05", "QUARTER": "FY26 Q3", "MONTH": "FY26 P07", "YEAR_MONTH": "2025-09", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 11, "ABS_DIFF": -10, "PERCENT_DIFF": 0.9090909090909091, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6625, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-09-01", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/09/05", "QUARTER": "FY26 Q3", "MONTH": "FY26 P07", "YEAR_MONTH": "2025-09", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 11, "ABS_DIFF": -10, "PERCENT_DIFF": 0.9090909090909091, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6625, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-09-01", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/09/05", "QUARTER": "FY26 Q3", "MONTH": "FY26 P07", "YEAR_MONTH": "2025-09", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 10, "ABS_DIFF": -9, "PERCENT_DIFF": 0.9, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6625, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-09-01", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/09/05", "QUARTER": "FY26 Q3", "MONTH": "FY26 P07", "YEAR_MONTH": "2025-09", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 9, "ABS_DIFF": -8, "PERCENT_DIFF": 0.8888888888888888, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6625, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-09-01", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/09/05", "QUARTER": "FY26 Q3", "MONTH": "FY26 P07", "YEAR_MONTH": "2025-09", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 11, "ABS_DIFF": -10, "PERCENT_DIFF": 0.9090909090909091, "ANOMALY_TYPE": "High Variance (>10%)" }, { "LOCATION_ID": 1600, "PRODUCT_ID": "VCP_3900", "UNIQUE_ID": 6625, "LOCATION_DESC": "Plant SCS 1600", "PROD_DESC": "Steelcase Series 1 Chair Task VCP 3900", "WEEK_DATE": "2025-09-01", "YEAR": 2025, "WEEK_PERIODDESC": "CW 2025/09/05", "QUARTER": "FY26 Q3", "MONTH": "FY26 P07", "YEAR_MONTH": "2025-09", "MODEL_VERSION": "Active", "VERSION": "__BASELINE", "SCENARIO": "_PLAN", "VERSION_NAME": "Base Version", "SCENARIO_NAME": "_PLAN", "ACTUAL_QTY": 1, "FORECAST_QTY": 11, "ABS_DIFF": -10, "PERCENT_DIFF": 0.9090909090909091, "ANOMALY_TYPE": "High Variance (>10%)" }]
            that.newChartData = chartData.filter(item => item.LOCATION_ID === 1600 && item.PRODUCT_ID === "VCP_3900");
            this._setActualForecastCard(that.newChartData, "Week", "WEEK_DATE");
            //     } else {
            //         sap.m.MessageToast.show("No data available for Locations and Products");
            //     }

            //     sap.ui.core.BusyIndicator.hide();
            // })
            // .catch((oError) => {
            //     sap.ui.core.BusyIndicator.hide();
            //     console.error("Read failed:", oError);
            //     sap.m.MessageBox.error("Failed to load data: " + oError.message);
            // });
        },
        // _setCharAnalysisCard: function (data) {
        //     const oCard = this.byId("MyCardIdChar");
        //     if (oCard) oCard.setBusy(true);
        //     const forecastCardManifest = {
        //         "sap.app": {
        //             "id": "vcp.v4card.forecastAnalysis",
        //             "type": "card",
        //             "applicationVersion": { "version": "1.0.0" }
        //         },
        //         "sap.ui": { "technology": "UI5" },
        //         "sap.card": {
        //             "type": "Analytical",
        //             "header": {
        //                 "title": "Forecast vs Actual %",
        //                 "subTitle": "By Week / Characteristic",
        //                 "titleMaxLines": 1,
        //                 "subTitleMaxLines": 1
        //             },
        //             "data": {
        //                 "json": data
        //             },
        //             "content": {
        //                 "chartType": "bar",
        //                 "legend": { "visible": true },
        //                 "plotArea": {
        //                     "dataLabel": { "visible": true }
        //                 },
        //                 "dimensions": [
        //                     {
        //                         "name": "Week / Characteristic",
        //                         "value": "{WEEK_CHAR}"
        //                     }
        //                 ],
        //                 "measures": [
        //                     {
        //                         "name": "Forecast %",
        //                         "value": "{FORECAST_SALES_PERCENTAGE}"
        //                     },
        //                     {
        //                         "name": "Actual %",
        //                         "value": "{PERCENTAGE}"
        //                     }
        //                 ],
        //                 "feeds": [
        //                     {
        //                         "uid": "categoryAxis",
        //                         "type": "Dimension",
        //                         "values": ["Week / Characteristic"]
        //                     },
        //                     {
        //                         "uid": "valueAxis",
        //                         "type": "Measure",
        //                         "values": ["Forecast %", "Actual %"]
        //                     }
        //                 ]
        //             }
        //         }
        //     };
        //     oCard.setManifest(forecastCardManifest);
        //     oCard.setBusy(false);
        // },
        _setActualForecastCard: function (oData, sName, sID) {
            const oManifest = {
                "sap.app": {
                    "id": "vcp.v4card.forecastQuantity",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": { "technology": "UI5" },
                "sap.card": {
                    "type": "Analytical",
                    "header": {
                        "title": "Forecast Actual Quantity, Forecast Quantity",
                        "subTitle": "By " + sName,
                        "titleMaxLines": 1,
                        "subTitleMaxLines": 1
                    },
                    "data": {
                        "json": oData
                    },
                    "configuration": {
                        "filters": {
                            "Period": {
                                "type": "ComboBox",
                                "label": "Dataset",
                                "value": sName, // default value week
                                "item": {
                                    "path": "/",
                                    "template": {
                                        "key": "{text}",
                                        "title": "{text}"
                                    }
                                },
                                "data": {
                                    "json": [
                                        { "text": "Week" },
                                        { "text": "Month" },
                                        { "text": "Year" }
                                    ]
                                }
                            }
                        }
                    },
                    "content": {
                        "title": {
                            "text": "Forecast Actual vs Forecast"

                        },
                        "chartType": "line",
                        "legend": { "visible": true },
                        "plotArea": {
                            "dataLabel": { "visible": true },
                            "window": { "start": 0, "end": 100 }
                        },
                        "dimensions": [
                            {
                                "name": sName,
                                "value": "{" + sID + "}"
                            }
                        ],
                        "measures": [
                            {
                                "name": "Forecast Actual Quantity",
                                "value": "{ACTUAL_QTY}"
                            },
                            {
                                "name": "Forecast Quantity",
                                "value": "{FORECAST_QTY}"
                            }
                        ],
                        "feeds": [
                            {
                                "uid": "categoryAxis",
                                "type": "Dimension",
                                "values": [sName]
                            },
                            {
                                "uid": "valueAxis",
                                "type": "Measure",
                                "values": ["Forecast Actual Quantity", "Forecast Quantity"]
                            }
                        ]
                    }
                }
            };

            this._applyCardManifestNew("MyCardIdFore", oManifest);

        },
        _applyCardManifestNew: function (sCardId, oManifest) {
            var oCard = this.byId(sCardId);
            if (oCard) {
                oCard.setManifest(oManifest);

                // attach configurationChange instead of filterChange
                oCard.detachConfigurationChange(this.onFilterChangePeriod, this);
                oCard.attachConfigurationChange(this.onFilterChangePeriod, this);
            }
            sap.ui.core.BusyIndicator.hide();
        },
        onFilterChangePeriod: function (oEvent) {
            var mChanges = oEvent.getParameters().changes;
            if (mChanges) {
                if (Object.keys(mChanges).some(key => key.includes("Period"))) {
                    var selected = mChanges["/sap.card/configuration/filters/Period/value"];
                    if (selected === "Week") {
                        var sName = "Week";
                        var sID = "WEEK_DATE"
                    }
                    else if (selected === "Year") {
                        var sName = "Year";
                        var sID = "YEAR"
                    }
                    else if (selected === "Month") {
                        var sName = "Month";
                        var sID = "MONTH"
                    }
                    this._setActualForecastCard(that.newChartData, sName, sID);
                }
            }
        }
    });
});

