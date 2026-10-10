/* ================= TAB DESIGN / CODE & ACCORDION ================= */
const setAcc = ($sec, open) => {
  $sec.toggleClass('open', open);
  $sec.find('.fg-body').prop('hidden', !open);
  $sec.find('.fg-acc-toggle').attr('aria-expanded', open);
};
$('#view-design').on('click', '.fg-acc-toggle', function() {
  const $s = $(this).closest('.fg-acc');
  setAcc($s, !$s.hasClass('open'));
});
$('#view-design').on('click', '.fg-add', function() {
  setAcc($(this).closest('.fg-acc'), true);
});
$('#view-design').on('input', '.fg-color input[type="color"]', function() {
  $(this).siblings('.hex').val(this.value.slice(1).toUpperCase());
});
$('#view-design').on('input', '.fg-color .hex', function() {
  if (/^[0-9a-f]{6}$/i.test(this.value)) $(this).siblings('input[type="color"]').val('#' + this.value);
});
$('.mode-tab').on('click', function() {
  const mode = $(this).data('mode');
  $('.mode-tab').removeClass('active').attr('aria-selected', false);
  $(this).addClass('active').attr('aria-selected', true);
  $('#view-design').prop('hidden', mode !== 'design');
  $('#view-code').prop('hidden', mode !== 'code');
});