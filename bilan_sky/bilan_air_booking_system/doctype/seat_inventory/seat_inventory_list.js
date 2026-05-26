// Client Script: Seat Inventory List View
// Color codes seats based on status

frappe.listview_settings['Seat Inventory'] = {
    get_indicator: function(doc) {
        var status_colors = {
            'Available': ['Available', 'green'],
            'Reserved': ['Reserved', 'orange'],
            'Booked': ['Booked', 'blue'],
            'Occupied': ['Occupied', 'darkgrey']
        };
        return status_colors[doc.status] || ['Unknown', 'grey'];
    },
    
    onload: function(listview) {
        // Add custom filter buttons
        listview.page.add_inner_button('Available Only', function() {
            listview.filter_area.add([[ 'Seat Inventory', 'status', '=', 'Available' ]]);
            listview.refresh();
        });
        
        listview.page.add_inner_button('Show All', function() {
            listview.filter_area.remove('status');
            listview.refresh();
        });
    }
};